-- Phase 24 — Focused Talent Project Applications
-- Owner: Applications module. Risk: proposal spam, late/duplicate application, private-evidence leakage, unauthorized company access, and unauditable hiring-state mutation.
-- Rollback: forward compensation only; disable application routes and RPC grants while retaining private application records and audit events for authorized retention.

create type public.project_application_state as enum (
  'draft', 'submitted', 'withdrawn', 'shortlisted', 'invited_to_trial', 'accepted', 'rejected', 'closed'
);

create table public.project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  state public.project_application_state not null default 'draft',
  profile_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_snapshot) = 'object'),
  evidence_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_snapshot) = 'array' and jsonb_array_length(evidence_snapshot) <= 6),
  availability text not null default '' check (char_length(availability) <= 240),
  timezone_overlap text not null default '' check (char_length(timezone_overlap) <= 160),
  motivation text not null default '' check (char_length(motivation) <= 600),
  relevant_experience text not null default '' check (char_length(relevant_experience) <= 900),
  project_response text not null default '' check (char_length(project_response) <= 800),
  approach text not null default '' check (char_length(approach) <= 1000),
  terms_confirmed boolean not null default false,
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object'),
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state <> 'submitted' or submitted_at is not null),
  check ((state = 'withdrawn') = (withdrawn_at is not null)),
  check (state <> 'submitted' or (terms_confirmed and terms_snapshot <> '{}'::jsonb))
);

create table public.project_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.project_applications(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'application.draft_created', 'application.draft_saved', 'application.submitted', 'application.withdrawn'
  )),
  previous_state public.project_application_state,
  next_state public.project_application_state,
  occurred_at timestamptz not null default now(),
  check ((event_type in ('application.submitted', 'application.withdrawn')) = (previous_state is not null and next_state is not null))
);

create unique index project_applications_one_active_per_talent_project_idx
  on public.project_applications(talent_user_id, project_id)
  where state in ('draft', 'submitted', 'shortlisted', 'invited_to_trial', 'accepted');
create index project_applications_talent_updated_idx
  on public.project_applications(talent_user_id, updated_at desc);
create index project_applications_organization_updated_idx
  on public.project_applications(organization_id, updated_at desc);
create index project_application_events_application_occurred_idx
  on public.project_application_events(application_id, occurred_at desc);

alter table public.project_applications enable row level security;
alter table public.project_application_events enable row level security;

create policy "talent can view own application records"
  on public.project_applications for select to authenticated
  using (talent_user_id = auth.uid());
create policy "authorized company members can view organization application records"
  on public.project_applications for select to authenticated
  using (public.has_organization_permission(organization_id, 'hiring_member'));
create policy "talent can view own application audit records"
  on public.project_application_events for select to authenticated
  using (exists (
    select 1 from public.project_applications application
    where application.id = application_id and application.talent_user_id = auth.uid()
  ));
create policy "authorized company members can view organization application audit records"
  on public.project_application_events for select to authenticated
  using (public.has_organization_permission(organization_id, 'hiring_member'));

create or replace function public.require_active_talent_application_context()
returns uuid
language sql security definer stable set search_path = public as $$
  select public.require_active_talent_project_context()
$$;

create or replace function public.project_application_payload_is_valid(requested_application jsonb)
returns boolean
language plpgsql immutable set search_path = public as $$
declare allowed_keys text[] := array[
  'evidence_ids', 'availability', 'timezone_overlap', 'motivation', 'relevant_experience', 'project_response', 'approach'
];
begin
  if jsonb_typeof(requested_application) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_application) key where key <> all(allowed_keys))
    or jsonb_typeof(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) > 6
    or exists (
      select 1
      from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) evidence
      where jsonb_typeof(evidence.value) <> 'string' or (evidence.value #>> '{}') !~ '^[0-9a-fA-F-]{36}$'
    )
    or (select count(*) from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)))
       <> (select count(distinct evidence.value #>> '{}') from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) evidence)
    or octet_length(requested_application::text) > 7000
    or char_length(coalesce(requested_application->>'availability', '')) > 240
    or char_length(coalesce(requested_application->>'timezone_overlap', '')) > 160
    or char_length(coalesce(requested_application->>'motivation', '')) > 600
    or char_length(coalesce(requested_application->>'relevant_experience', '')) > 900
    or char_length(coalesce(requested_application->>'project_response', '')) > 800
    or char_length(coalesce(requested_application->>'approach', '')) > 1000
  then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.get_application_eligible_project(requested_public_id text)
returns public.company_project_drafts
language plpgsql security definer stable set search_path = public as $$
declare result public.company_project_drafts;
begin
  select project.* into result
  from public.company_project_drafts project
  join public.company_project_publications publication on publication.project_id = project.id
  where publication.public_id = lower(trim(requested_public_id))
    and publication.state = 'accepting_applications'
    and project.state = 'accepting_applications'
    and project.visibility = 'public'
    and project.project_type <> 'private_invite_only'
    and project.application_deadline >= current_date;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function public.project_application_profile_snapshot(actor_id uuid)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'display_name', coalesce(nullif(profile.display_name, ''), settings.display_name, ''),
    'headline', coalesce(profile.headline, ''),
    'developer_focus', coalesce(profile.developer_focus, ''),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill_key', skill.skill_key, 'claimed_level', skill.claimed_level, 'context', skill.context) order by skill.skill_key)
      from public.talent_profile_skills skill
      where skill.user_id = actor_id
    ), '[]'::jsonb)
  )
  from (select 1) singleton
  left join public.talent_profile_drafts profile on profile.user_id = actor_id
  left join public.personal_settings settings on settings.user_id = actor_id
$$;

create or replace function public.project_application_evidence_snapshot(actor_id uuid, requested_evidence_ids uuid[])
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare result jsonb;
begin
  if cardinality(requested_evidence_ids) = 0 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'evidence_id', item.id,
    'source_version', item.version,
    'sharing_choice', 'application_private_receipt',
    'title', item.title,
    'short_summary', item.short_summary,
    'evidence_type', item.evidence_type,
    'user_role', item.user_role,
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill_key', skill.skill_key, 'context', skill.context) order by skill.skill_key)
      from public.work_evidence_skills skill
      where skill.evidence_id = item.id and skill.user_id = actor_id
    ), '[]'::jsonb)
  ) order by array_position(requested_evidence_ids, item.id)), '[]'::jsonb)
  into result
  from public.work_evidence_items item
  where item.user_id = actor_id
    and item.id = any(requested_evidence_ids)
    and item.state <> 'archived';
  if jsonb_array_length(result) <> cardinality(requested_evidence_ids) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return result;
end;
$$;

create or replace function public.project_application_terms_snapshot(project public.company_project_drafts)
returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'project_public_id', project.public_id,
    'project_title', project.title,
    'application_deadline', project.application_deadline,
    'compensation_status', project.compensation_status,
    'work_purpose', project.work_purpose,
    'timebox_hours', project.timebox_hours,
    'ownership_terms', project.ownership_terms,
    'data_access_restrictions', project.data_access_restrictions,
    'participant_expectations', project.participant_expectations,
    'expected_response_time', project.expected_response_time,
    'no_production_reuse', project.no_production_reuse
  )
$$;

create or replace function public.project_application_is_submittable(application public.project_applications)
returns boolean
language sql immutable set search_path = public as $$
  select char_length(trim(application.availability)) between 1 and 240
    and char_length(trim(application.timezone_overlap)) between 1 and 160
    and char_length(trim(application.motivation)) between 10 and 600
    and char_length(trim(application.relevant_experience)) between 10 and 900
    and char_length(trim(application.project_response)) between 10 and 800
    and char_length(trim(application.approach)) <= 1000
    and jsonb_typeof(application.profile_snapshot) = 'object'
    and jsonb_typeof(application.evidence_snapshot) = 'array'
    and jsonb_array_length(application.evidence_snapshot) between 1 and 6
$$;

create or replace function public.save_talent_project_application(
  requested_application_id uuid,
  requested_public_id text,
  requested_application jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_application_context();
  project_record public.company_project_drafts := public.get_application_eligible_project(requested_public_id);
  result public.project_applications;
  existing public.project_applications;
  evidence_ids uuid[] := array[]::uuid[];
  profile_snapshot jsonb;
  evidence_snapshot jsonb;
begin
  if not public.project_application_payload_is_valid(requested_application) then
    raise exception 'VALIDATION_FAILED';
  end if;

  select coalesce(array_agg((evidence.value #>> '{}')::uuid), array[]::uuid[])
    into evidence_ids
  from jsonb_array_elements(coalesce(requested_application->'evidence_ids', '[]'::jsonb)) evidence;
  profile_snapshot := public.project_application_profile_snapshot(actor_id);
  evidence_snapshot := public.project_application_evidence_snapshot(actor_id, evidence_ids);

  if requested_application_id is not null then
    select * into existing
    from public.project_applications
    where id = requested_application_id and talent_user_id = actor_id
    for update;
    if existing.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    if existing.project_id <> project_record.id or existing.state <> 'draft' then
      raise exception 'INVALID_STATE';
    end if;
    update public.project_applications set
      profile_snapshot = profile_snapshot,
      evidence_snapshot = evidence_snapshot,
      availability = left(trim(coalesce(requested_application->>'availability', '')), 240),
      timezone_overlap = left(trim(coalesce(requested_application->>'timezone_overlap', '')), 160),
      motivation = left(trim(coalesce(requested_application->>'motivation', '')), 600),
      relevant_experience = left(trim(coalesce(requested_application->>'relevant_experience', '')), 900),
      project_response = left(trim(coalesce(requested_application->>'project_response', '')), 800),
      approach = left(trim(coalesce(requested_application->>'approach', '')), 1000),
      terms_confirmed = false,
      terms_snapshot = '{}'::jsonb,
      updated_at = now()
    where id = existing.id
    returning * into result;
    insert into public.project_application_events (application_id, organization_id, actor_user_id, event_type)
    values (result.id, result.organization_id, actor_id, 'application.draft_saved');
  else
    if exists (
      select 1 from public.project_applications application
      where application.talent_user_id = actor_id
        and application.project_id = project_record.id
        and application.state in ('draft', 'submitted', 'shortlisted', 'invited_to_trial', 'accepted')
    ) then
      raise exception 'DUPLICATE_ACTIVE_APPLICATION';
    end if;
    insert into public.project_applications (
      project_id, organization_id, talent_user_id, profile_snapshot, evidence_snapshot,
      availability, timezone_overlap, motivation, relevant_experience, project_response, approach
    ) values (
      project_record.id, project_record.organization_id, actor_id, profile_snapshot, evidence_snapshot,
      left(trim(coalesce(requested_application->>'availability', '')), 240),
      left(trim(coalesce(requested_application->>'timezone_overlap', '')), 160),
      left(trim(coalesce(requested_application->>'motivation', '')), 600),
      left(trim(coalesce(requested_application->>'relevant_experience', '')), 900),
      left(trim(coalesce(requested_application->>'project_response', '')), 800),
      left(trim(coalesce(requested_application->>'approach', '')), 1000)
    ) returning * into result;
    insert into public.project_application_events (application_id, organization_id, actor_user_id, event_type)
    values (result.id, result.organization_id, actor_id, 'application.draft_created');
  end if;
  return jsonb_build_object('id', result.id, 'public_id', project_record.public_id, 'state', result.state);
exception when unique_violation then
  raise exception 'DUPLICATE_ACTIVE_APPLICATION';
end;
$$;

create or replace function public.submit_talent_project_application(
  requested_application_id uuid,
  confirmed_project_terms boolean
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := public.require_active_talent_application_context();
  result public.project_applications;
  project_record public.company_project_drafts;
begin
  if confirmed_project_terms is distinct from true then raise exception 'VALIDATION_FAILED'; end if;
  select * into result
  from public.project_applications
  where id = requested_application_id and talent_user_id = actor_id
  for update;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.state <> 'draft' or not public.project_application_is_submittable(result) then
    raise exception 'VALIDATION_FAILED';
  end if;
  select public.get_application_eligible_project(project.public_id) into project_record
  from public.company_project_drafts project where project.id = result.project_id;
  if project_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.project_applications set
    state = 'submitted', terms_confirmed = true,
    terms_snapshot = public.project_application_terms_snapshot(project_record),
    submitted_at = now(), updated_at = now()
  where id = result.id
  returning * into result;
  insert into public.project_application_events (
    application_id, organization_id, actor_user_id, event_type, previous_state, next_state
  ) values (
    result.id, result.organization_id, actor_id, 'application.submitted', 'draft', 'submitted'
  );
  return jsonb_build_object('id', result.id, 'public_id', project_record.public_id, 'state', result.state);
end;
$$;

create or replace function public.withdraw_talent_project_application(requested_application_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := public.require_active_talent_application_context(); result public.project_applications; previous public.project_application_state;
begin
  select * into result
  from public.project_applications
  where id = requested_application_id and talent_user_id = actor_id
  for update;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  previous := result.state;
  if previous not in ('draft', 'submitted', 'shortlisted', 'invited_to_trial') then
    raise exception 'INVALID_STATE';
  end if;
  update public.project_applications set state = 'withdrawn', withdrawn_at = now(), updated_at = now()
  where id = result.id returning * into result;
  insert into public.project_application_events (
    application_id, organization_id, actor_user_id, event_type, previous_state, next_state
  ) values (
    result.id, result.organization_id, actor_id, 'application.withdrawn', previous, 'withdrawn'
  );
  return jsonb_build_object('id', result.id, 'state', result.state);
end;
$$;

create or replace function public.get_talent_project_applications(maximum_count integer default 50)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', application.id, 'state', application.state, 'project_public_id', project.public_id,
    'project_title', project.title, 'organization_name', organization.name,
    'expected_response_time', coalesce(application.terms_snapshot->>'expected_response_time', project.expected_response_time),
    'application_deadline', coalesce(application.terms_snapshot->>'application_deadline', project.application_deadline::text),
    'submitted_at', application.submitted_at, 'withdrawn_at', application.withdrawn_at, 'updated_at', application.updated_at
  ) order by application.updated_at desc), '[]'::jsonb)
  from (
    select * from public.project_applications
    where talent_user_id = public.require_active_talent_application_context()
    order by updated_at desc
    limit least(greatest(coalesce(maximum_count, 0), 0), 100)
  ) application
  join public.company_project_drafts project on project.id = application.project_id
  join public.organizations organization on organization.id = application.organization_id
$$;

create or replace function public.get_talent_project_application(requested_application_id uuid)
returns jsonb
language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', application.id, 'state', application.state,
    'project', jsonb_build_object(
      'public_id', project.public_id, 'title', project.title, 'organization_name', organization.name,
      'application_deadline', coalesce(application.terms_snapshot->>'application_deadline', project.application_deadline::text),
      'expected_response_time', coalesce(application.terms_snapshot->>'expected_response_time', project.expected_response_time)
    ),
    'profile_snapshot', application.profile_snapshot, 'evidence_snapshot', application.evidence_snapshot,
    'availability', application.availability, 'timezone_overlap', application.timezone_overlap,
    'motivation', application.motivation, 'relevant_experience', application.relevant_experience,
    'project_response', application.project_response, 'approach', application.approach,
    'terms_confirmed', application.terms_confirmed, 'terms_snapshot', application.terms_snapshot,
    'submitted_at', application.submitted_at, 'withdrawn_at', application.withdrawn_at,
    'created_at', application.created_at, 'updated_at', application.updated_at,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'previous_state', event.previous_state, 'next_state', event.next_state, 'occurred_at', event.occurred_at) order by event.occurred_at asc)
      from public.project_application_events event where event.application_id = application.id
    ), '[]'::jsonb)
  )
  from public.project_applications application
  join public.company_project_drafts project on project.id = application.project_id
  join public.organizations organization on organization.id = application.organization_id
  where application.id = requested_application_id
    and application.talent_user_id = public.require_active_talent_application_context()
$$;

create or replace function public.get_company_project_application_receipt(requested_application_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare result public.project_applications; project_info jsonb;
begin
  select application.* into result
  from public.project_applications application
  where application.id = requested_application_id
    and public.has_organization_permission(application.organization_id, 'hiring_member');
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select jsonb_build_object('public_id', project.public_id, 'title', project.title, 'organization_name', organization.name)
    into project_info
  from public.company_project_drafts project
  join public.organizations organization on organization.id = project.organization_id
  where project.id = result.project_id;
  if result.state in ('withdrawn', 'rejected') then
    return jsonb_build_object(
      'id', result.id, 'state', result.state,
      'project', project_info,
      'terms_snapshot', result.terms_snapshot,
      'submitted_at', result.submitted_at, 'withdrawn_at', result.withdrawn_at,
      'retention_notice', 'This withdrawn or rejected application is retained only as an authorized record. Detailed application content is no longer shown in this receipt.'
    );
  end if;
  return jsonb_build_object(
    'id', result.id, 'state', result.state,
    'project', project_info,
    'profile_snapshot', result.profile_snapshot, 'evidence_snapshot', result.evidence_snapshot,
    'availability', result.availability, 'timezone_overlap', result.timezone_overlap,
    'motivation', result.motivation, 'relevant_experience', result.relevant_experience,
    'project_response', result.project_response, 'approach', result.approach,
    'terms_snapshot', result.terms_snapshot, 'submitted_at', result.submitted_at,
    'created_at', result.created_at, 'updated_at', result.updated_at,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'previous_state', event.previous_state, 'next_state', event.next_state, 'occurred_at', event.occurred_at) order by event.occurred_at asc)
      from public.project_application_events event where event.application_id = result.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on table public.project_applications, public.project_application_events from anon, authenticated;
revoke all on function public.require_active_talent_application_context(), public.project_application_payload_is_valid(jsonb), public.get_application_eligible_project(text), public.project_application_profile_snapshot(uuid), public.project_application_evidence_snapshot(uuid, uuid[]), public.project_application_terms_snapshot(public.company_project_drafts), public.project_application_is_submittable(public.project_applications) from public, anon, authenticated;
revoke all on function public.save_talent_project_application(uuid, text, jsonb), public.submit_talent_project_application(uuid, boolean), public.withdraw_talent_project_application(uuid), public.get_talent_project_applications(integer), public.get_talent_project_application(uuid), public.get_company_project_application_receipt(uuid) from public, anon;
grant execute on function public.save_talent_project_application(uuid, text, jsonb), public.submit_talent_project_application(uuid, boolean), public.withdraw_talent_project_application(uuid), public.get_talent_project_applications(integer), public.get_talent_project_application(uuid), public.get_company_project_application_receipt(uuid) to authenticated;
