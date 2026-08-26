-- Phase 27 — Controlled reviewer onboarding and approval.
-- Owner: Reviews and administration modules. Risk: unauthorized reviewer trust, private applicant disclosure, conflicted/self-review, and reviewer-material access after pause or suspension.
-- Rollback: forward compensation only; revoke Phase 27 RPC grants and disable private routes while retaining restricted reviewer application and audit history.

create type public.reviewer_application_state as enum (
  'requested',
  'in_screening',
  'needs_more_evidence',
  'approved',
  'active',
  'paused',
  'suspended',
  'rejected'
);

create type public.reviewer_availability_status as enum (
  'available',
  'limited',
  'unavailable'
);

create type public.reviewer_evidence_type as enum (
  'professional_work',
  'open_source',
  'leadership_or_mentorship',
  'prior_review_or_assessment',
  'technical_writing',
  'reference'
);

create type public.reviewer_conflict_kind as enum (
  'close_collaboration',
  'current_or_recent_employment',
  'financial_interest',
  'personal_relationship',
  'other'
);

create type public.reviewer_conflict_scope as enum ('organization', 'general');

create table public.reviewer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  state public.reviewer_application_state not null default 'requested',
  revision integer not null default 0 check (revision >= 0),
  current_policy_version text,
  current_policy_agreed_at timestamptz,
  conflict_declarations_confirmed_at timestamptz,
  resolution_note text not null default '' check (char_length(resolution_note) <= 600),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    state not in ('in_screening', 'needs_more_evidence', 'approved', 'active', 'paused', 'suspended', 'rejected')
    or submitted_at is not null
  ),
  check (
    state <> 'active'
    or (
      current_policy_version = 'reviewer-conduct-v1'
      and current_policy_agreed_at is not null
      and conflict_declarations_confirmed_at is not null
    )
  )
);

create table public.reviewer_profiles (
  application_id uuid primary key references public.reviewer_applications(id) on delete restrict,
  user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null default '' check (char_length(display_name) <= 120),
  professional_focus text not null default '' check (char_length(professional_focus) <= 500),
  experience_context text not null default '' check (char_length(experience_context) <= 1400),
  review_experience text not null default '' check (char_length(review_experience) <= 1400),
  timezone text not null default '' check (char_length(timezone) <= 80),
  languages text[] not null default array[]::text[] check (cardinality(languages) <= 12),
  availability_status public.reviewer_availability_status not null default 'unavailable',
  max_concurrent_reviews integer not null default 1 check (max_concurrent_reviews between 1 and 25),
  feedback_style text not null default '' check (char_length(feedback_style) <= 700),
  public_bio text not null default '' check (char_length(public_bio) <= 900),
  updated_at timestamptz not null default now()
);

create table public.reviewer_profile_skills (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.reviewer_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  skill_key text not null check (skill_key in (
    'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
    'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
    'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
    'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
    'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
  )),
  taxonomy_version text not null default '1.0.0' check (taxonomy_version = '1.0.0'),
  expertise_context text not null default '' check (char_length(expertise_context) <= 500),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reviewer_application_evidence (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.reviewer_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  evidence_type public.reviewer_evidence_type not null,
  title text not null default '' check (char_length(title) <= 160),
  description text not null default '' check (char_length(description) <= 1400),
  source_url text not null default '' check (char_length(source_url) <= 500 and (source_url = '' or source_url ~ '^https://')),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reviewer_conflict_declarations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.reviewer_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  relationship_kind public.reviewer_conflict_kind not null,
  scope public.reviewer_conflict_scope not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  context text not null default '' check (char_length(context) <= 700),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (scope = 'organization' and organization_id is not null)
    or (scope = 'general' and organization_id is null)
  )
);

create table public.reviewer_policy_agreements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.reviewer_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  policy_version text not null check (policy_version = 'reviewer-conduct-v1'),
  agreed_at timestamptz not null default now()
);

create table public.reviewer_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.reviewer_applications(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'reviewer_application.draft_saved',
    'reviewer_application.submitted',
    'reviewer_application.policy_agreed',
    'reviewer_application.state_changed',
    'reviewer_application.activated'
  )),
  previous_state public.reviewer_application_state,
  next_state public.reviewer_application_state,
  application_revision integer not null check (application_revision >= 0),
  note text not null default '' check (char_length(note) <= 600),
  occurred_at timestamptz not null default now(),
  check (
    (event_type = 'reviewer_application.state_changed')
    = (previous_state is not null and next_state is not null)
  )
);

create index reviewer_applications_state_updated_idx
  on public.reviewer_applications(state, updated_at desc);
create index reviewer_profile_skills_current_application_idx
  on public.reviewer_profile_skills(application_id, skill_key)
  where is_current;
create index reviewer_evidence_current_application_idx
  on public.reviewer_application_evidence(application_id, created_at desc)
  where is_current;
create index reviewer_conflicts_current_scope_idx
  on public.reviewer_conflict_declarations(user_id, scope, organization_id)
  where is_current;
create index reviewer_policy_agreements_user_version_idx
  on public.reviewer_policy_agreements(user_id, policy_version, agreed_at desc);
create index reviewer_application_events_application_occurred_idx
  on public.reviewer_application_events(application_id, occurred_at asc);

alter table public.reviewer_applications enable row level security;
alter table public.reviewer_profiles enable row level security;
alter table public.reviewer_profile_skills enable row level security;
alter table public.reviewer_application_evidence enable row level security;
alter table public.reviewer_conflict_declarations enable row level security;
alter table public.reviewer_policy_agreements enable row level security;
alter table public.reviewer_application_events enable row level security;

create or replace function public.has_active_platform_administrator_context()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_administrator()
    and exists (
      select 1 from public.active_contexts context
      where context.user_id = auth.uid()
        and context.active_role = 'administrator'
        and context.active_organization_id is null
    )
$$;

create policy "reviewer applicants can view their own application"
  on public.reviewer_applications for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own profile"
  on public.reviewer_profiles for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own skills"
  on public.reviewer_profile_skills for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own evidence"
  on public.reviewer_application_evidence for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own conflicts"
  on public.reviewer_conflict_declarations for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own agreements"
  on public.reviewer_policy_agreements for select to authenticated
  using (user_id = auth.uid() or public.has_active_platform_administrator_context());
create policy "reviewer applicants can view their own application audit"
  on public.reviewer_application_events for select to authenticated
  using (
    public.has_active_platform_administrator_context()
    or exists (
      select 1 from public.reviewer_applications application
      where application.id = application_id and application.user_id = auth.uid()
    )
  );

create or replace function public.reviewer_application_payload_is_valid(
  requested_profile jsonb,
  requested_skills jsonb,
  requested_evidence jsonb,
  requested_conflicts jsonb
)
returns boolean
language plpgsql immutable set search_path = public as $$
declare
  allowed_profile_keys text[] := array[
    'display_name','professional_focus','experience_context','review_experience',
    'timezone','languages','availability_status','max_concurrent_reviews',
    'feedback_style','public_bio'
  ];
begin
  if jsonb_typeof(requested_profile) <> 'object'
    or jsonb_typeof(requested_skills) <> 'array'
    or jsonb_typeof(requested_evidence) <> 'array'
    or jsonb_typeof(requested_conflicts) <> 'array'
    or octet_length(requested_profile::text) > 9000
    or octet_length(requested_skills::text) > 9000
    or octet_length(requested_evidence::text) > 18000
    or octet_length(requested_conflicts::text) > 9000
    or jsonb_array_length(requested_skills) > 12
    or jsonb_array_length(requested_evidence) > 12
    or jsonb_array_length(requested_conflicts) > 12
    or exists (select 1 from jsonb_object_keys(requested_profile) key where key <> all(allowed_profile_keys))
    or jsonb_typeof(coalesce(requested_profile->'languages', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_profile->'languages', '[]'::jsonb)) > 12
    or exists (
      select 1 from jsonb_array_elements(coalesce(requested_profile->'languages', '[]'::jsonb)) language
      where jsonb_typeof(language.value) <> 'string'
         or char_length(trim(language.value #>> '{}')) not between 2 and 40
    )
    or (select count(*) from jsonb_array_elements(coalesce(requested_profile->'languages', '[]'::jsonb)))
       <> (select count(distinct lower(trim(language.value #>> '{}'))) from jsonb_array_elements(coalesce(requested_profile->'languages', '[]'::jsonb)) language)
    or coalesce(requested_profile->>'availability_status', 'unavailable') not in ('available', 'limited', 'unavailable')
    or coalesce(requested_profile->>'max_concurrent_reviews', '') !~ '^[0-9]+$'
    or (requested_profile->>'max_concurrent_reviews')::integer not between 1 and 25
    or char_length(coalesce(requested_profile->>'display_name', '')) > 120
    or char_length(coalesce(requested_profile->>'professional_focus', '')) > 500
    or char_length(coalesce(requested_profile->>'experience_context', '')) > 1400
    or char_length(coalesce(requested_profile->>'review_experience', '')) > 1400
    or char_length(coalesce(requested_profile->>'timezone', '')) > 80
    or char_length(coalesce(requested_profile->>'feedback_style', '')) > 700
    or char_length(coalesce(requested_profile->>'public_bio', '')) > 900
    or exists (
      select 1 from jsonb_array_elements(requested_skills) skill
      where jsonb_typeof(skill.value) <> 'object'
        or exists (select 1 from jsonb_object_keys(skill.value) key where key not in ('skill_key', 'expertise_context'))
        or skill.value->>'skill_key' not in (
          'javascript','typescript','html','css','web-accessibility','http-web-fundamentals','git',
          'react','nextjs','state-management','component-design','responsive-layout','performance-optimization','testing',
          'nodejs','api-design','authentication','authorization','data-validation','background-jobs','observability',
          'postgresql','data-modeling','sql','cloud-deployment','ci-cd','caching','security-fundamentals',
          'requirements-interpretation','debugging','technical-communication','code-review','documentation','collaboration'
        )
        or char_length(coalesce(skill.value->>'expertise_context', '')) > 500
    )
    or (select count(*) from jsonb_array_elements(requested_skills))
       <> (select count(distinct skill.value->>'skill_key') from jsonb_array_elements(requested_skills) skill)
    or exists (
      select 1 from jsonb_array_elements(requested_evidence) evidence
      where jsonb_typeof(evidence.value) <> 'object'
        or exists (select 1 from jsonb_object_keys(evidence.value) key where key not in ('evidence_type', 'title', 'description', 'source_url'))
        or evidence.value->>'evidence_type' not in ('professional_work','open_source','leadership_or_mentorship','prior_review_or_assessment','technical_writing','reference')
        or char_length(coalesce(evidence.value->>'title', '')) > 160
        or char_length(coalesce(evidence.value->>'description', '')) > 1400
        or char_length(coalesce(evidence.value->>'source_url', '')) > 500
        or (coalesce(evidence.value->>'source_url', '') <> '' and evidence.value->>'source_url' !~ '^https://')
    )
    or exists (
      select 1 from jsonb_array_elements(requested_conflicts) conflict
      where jsonb_typeof(conflict.value) <> 'object'
        or exists (select 1 from jsonb_object_keys(conflict.value) key where key not in ('relationship_kind', 'scope', 'organization_id', 'context'))
        or conflict.value->>'relationship_kind' not in ('close_collaboration','current_or_recent_employment','financial_interest','personal_relationship','other')
        or conflict.value->>'scope' not in ('organization','general')
        or char_length(coalesce(conflict.value->>'context', '')) > 700
        or (
          conflict.value->>'scope' = 'organization'
          and coalesce(conflict.value->>'organization_id', '') !~ '^[0-9a-fA-F-]{36}$'
        )
        or (
          conflict.value->>'scope' = 'general'
          and coalesce(conflict.value->>'organization_id', '') <> ''
        )
    )
  then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.reviewer_profile_is_submittable(
  requested_application_id uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reviewer_profiles profile
    where profile.application_id = requested_application_id
      and char_length(trim(profile.display_name)) between 2 and 120
      and char_length(trim(profile.professional_focus)) between 10 and 500
      and char_length(trim(profile.experience_context)) between 20 and 1400
      and char_length(trim(profile.review_experience)) between 10 and 1400
      and char_length(trim(profile.timezone)) between 1 and 80
      and cardinality(profile.languages) >= 1
      and char_length(trim(profile.feedback_style)) between 10 and 700
      and char_length(trim(profile.public_bio)) between 10 and 900
  )
  and exists (
    select 1 from public.reviewer_profile_skills skill
    where skill.application_id = requested_application_id and skill.is_current
  )
  and exists (
    select 1 from public.reviewer_application_evidence evidence
    where evidence.application_id = requested_application_id
      and evidence.is_current
      and char_length(trim(evidence.title)) between 3 and 160
      and char_length(trim(evidence.description)) between 20 and 1400
  )
$$;

create or replace function public.save_reviewer_application(
  requested_profile jsonb,
  requested_skills jsonb,
  requested_evidence jsonb,
  requested_conflicts jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  application_record public.reviewer_applications;
  next_revision integer;
  skill jsonb;
  evidence jsonb;
  conflict jsonb;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.reviewer_application_payload_is_valid(requested_profile, requested_skills, requested_evidence, requested_conflicts) then
    raise exception 'VALIDATION_FAILED';
  end if;

  select * into application_record
  from public.reviewer_applications
  where user_id = actor_id
  for update;

  if application_record.id is not null
    and application_record.state not in ('requested', 'needs_more_evidence') then
    raise exception 'INVALID_STATE';
  end if;

  if application_record.id is null then
    insert into public.reviewer_applications (user_id)
    values (actor_id)
    returning * into application_record;
  end if;

  next_revision := application_record.revision + 1;
  update public.reviewer_applications
  set revision = next_revision,
      updated_at = now()
  where id = application_record.id
  returning * into application_record;

  insert into public.reviewer_profiles (
    application_id, user_id, display_name, professional_focus, experience_context,
    review_experience, timezone, languages, availability_status,
    max_concurrent_reviews, feedback_style, public_bio, updated_at
  ) values (
    application_record.id, actor_id,
    left(trim(coalesce(requested_profile->>'display_name', '')), 120),
    left(trim(coalesce(requested_profile->>'professional_focus', '')), 500),
    left(trim(coalesce(requested_profile->>'experience_context', '')), 1400),
    left(trim(coalesce(requested_profile->>'review_experience', '')), 1400),
    left(trim(coalesce(requested_profile->>'timezone', '')), 80),
    coalesce(array(select lower(trim(value #>> '{}')) from jsonb_array_elements(coalesce(requested_profile->'languages', '[]'::jsonb)) value), array[]::text[]),
    coalesce(requested_profile->>'availability_status', 'unavailable')::public.reviewer_availability_status,
    (requested_profile->>'max_concurrent_reviews')::integer,
    left(trim(coalesce(requested_profile->>'feedback_style', '')), 700),
    left(trim(coalesce(requested_profile->>'public_bio', '')), 900),
    now()
  ) on conflict (application_id) do update set
    display_name = excluded.display_name,
    professional_focus = excluded.professional_focus,
    experience_context = excluded.experience_context,
    review_experience = excluded.review_experience,
    timezone = excluded.timezone,
    languages = excluded.languages,
    availability_status = excluded.availability_status,
    max_concurrent_reviews = excluded.max_concurrent_reviews,
    feedback_style = excluded.feedback_style,
    public_bio = excluded.public_bio,
    updated_at = now();

  update public.reviewer_profile_skills
  set is_current = false
  where application_id = application_record.id and is_current;
  for skill in select value from jsonb_array_elements(requested_skills) loop
    insert into public.reviewer_profile_skills (
      application_id, user_id, skill_key, expertise_context, is_current
    ) values (
      application_record.id, actor_id, skill->>'skill_key',
      left(trim(coalesce(skill->>'expertise_context', '')), 500), true
    );
  end loop;

  update public.reviewer_application_evidence
  set is_current = false
  where application_id = application_record.id and is_current;
  for evidence in select value from jsonb_array_elements(requested_evidence) loop
    insert into public.reviewer_application_evidence (
      application_id, user_id, evidence_type, title, description, source_url, is_current
    ) values (
      application_record.id, actor_id,
      (evidence->>'evidence_type')::public.reviewer_evidence_type,
      left(trim(coalesce(evidence->>'title', '')), 160),
      left(trim(coalesce(evidence->>'description', '')), 1400),
      trim(coalesce(evidence->>'source_url', '')),
      true
    );
  end loop;

  update public.reviewer_conflict_declarations
  set is_current = false
  where application_id = application_record.id and is_current;
  for conflict in select value from jsonb_array_elements(requested_conflicts) loop
    insert into public.reviewer_conflict_declarations (
      application_id, user_id, relationship_kind, scope, organization_id, context, is_current
    ) values (
      application_record.id, actor_id,
      (conflict->>'relationship_kind')::public.reviewer_conflict_kind,
      (conflict->>'scope')::public.reviewer_conflict_scope,
      nullif(conflict->>'organization_id', '')::uuid,
      left(trim(coalesce(conflict->>'context', '')), 700),
      true
    );
  end loop;

  insert into public.capability_requests (user_id, requested_role, status, requested_at, resolved_at, resolved_by, resolution_note)
  values (actor_id, 'reviewer', 'pending', now(), null, null, null)
  on conflict (user_id, requested_role) do update set
    status = case
      when public.capability_requests.status in ('declined', 'withdrawn') then 'pending'::public.capability_request_status
      else public.capability_requests.status
    end,
    requested_at = case
      when public.capability_requests.status in ('declined', 'withdrawn') then now()
      else public.capability_requests.requested_at
    end,
    resolved_at = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolved_at
    end,
    resolved_by = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolved_by
    end,
    resolution_note = case
      when public.capability_requests.status in ('declined', 'withdrawn') then null
      else public.capability_requests.resolution_note
    end;

  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.draft_saved', application_record.revision
  );

  return jsonb_build_object('id', application_record.id, 'state', application_record.state, 'revision', application_record.revision);
end;
$$;

create or replace function public.submit_reviewer_application(
  acknowledged_conflicts boolean,
  acknowledged_policy boolean
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  application_record public.reviewer_applications;
  previous_state public.reviewer_application_state;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if acknowledged_conflicts is distinct from true or acknowledged_policy is distinct from true then
    raise exception 'VALIDATION_FAILED';
  end if;
  select * into application_record
  from public.reviewer_applications
  where user_id = actor_id
  for update;
  if application_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if application_record.state not in ('requested', 'needs_more_evidence')
    or not public.reviewer_profile_is_submittable(application_record.id) then
    raise exception 'VALIDATION_FAILED';
  end if;

  previous_state := application_record.state;
  update public.reviewer_applications
  set state = 'in_screening',
      current_policy_version = 'reviewer-conduct-v1',
      current_policy_agreed_at = now(),
      conflict_declarations_confirmed_at = now(),
      submitted_at = coalesce(submitted_at, now()),
      updated_at = now()
  where id = application_record.id
  returning * into application_record;
  insert into public.reviewer_policy_agreements (application_id, user_id, policy_version)
  values (application_record.id, actor_id, 'reviewer-conduct-v1');
  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.policy_agreed', application_record.revision
  );
  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, previous_state, next_state, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.state_changed', previous_state, 'in_screening', application_record.revision
  );
  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.submitted', application_record.revision
  );
  return jsonb_build_object('id', application_record.id, 'state', application_record.state);
end;
$$;

create or replace function public.reviewer_admin_transition_is_valid(
  current_state public.reviewer_application_state,
  requested_state public.reviewer_application_state
)
returns boolean
language sql immutable set search_path = pg_catalog as $$
  select (current_state = 'in_screening' and requested_state in ('needs_more_evidence', 'approved', 'rejected'))
    or (current_state = 'needs_more_evidence' and requested_state = 'rejected')
    or (current_state = 'approved' and requested_state in ('paused', 'suspended'))
    or (current_state = 'active' and requested_state in ('paused', 'suspended'))
    or (current_state = 'paused' and requested_state in ('active', 'suspended'))
    or (current_state = 'suspended' and requested_state = 'approved')
$$;

create or replace function public.resolve_reviewer_application(
  target_user_id uuid,
  requested_state public.reviewer_application_state,
  requested_note text default ''
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  application_record public.reviewer_applications;
  previous_state public.reviewer_application_state;
  normalized_note text := left(trim(coalesce(requested_note, '')), 600);
begin
  if actor_id is null or not public.has_active_platform_administrator_context() or actor_id = target_user_id then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into application_record
  from public.reviewer_applications
  where user_id = target_user_id
  for update;
  if application_record.id is null
    or not public.reviewer_admin_transition_is_valid(application_record.state, requested_state)
    or (requested_state = 'needs_more_evidence' and char_length(normalized_note) < 10)
    or (requested_state in ('paused', 'suspended', 'rejected') and char_length(normalized_note) < 10) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  previous_state := application_record.state;
  update public.reviewer_applications
  set state = requested_state,
      resolution_note = normalized_note,
      updated_at = now()
  where id = application_record.id
  returning * into application_record;

  if requested_state in ('approved', 'active') then
    insert into public.role_capabilities (user_id, capabilities, reviewer_approved_at, granted_by)
    values (target_user_id, array['reviewer']::public.platform_role[], now(), actor_id)
    on conflict (user_id) do update set
      capabilities = array(select distinct role from unnest(public.role_capabilities.capabilities || excluded.capabilities) as role),
      reviewer_approved_at = coalesce(public.role_capabilities.reviewer_approved_at, excluded.reviewer_approved_at),
      granted_by = coalesce(public.role_capabilities.granted_by, excluded.granted_by),
      updated_at = now();
  elsif requested_state in ('suspended', 'rejected') then
    update public.role_capabilities
    set capabilities = array_remove(capabilities, 'reviewer'::public.platform_role),
        reviewer_approved_at = null,
        updated_at = now()
    where user_id = target_user_id;
  end if;

  update public.capability_requests
  set status = case
      when requested_state in ('approved', 'active', 'paused') then 'approved'::public.capability_request_status
      when requested_state in ('suspended', 'rejected') then 'declined'::public.capability_request_status
      else 'pending'::public.capability_request_status
    end,
    resolved_at = case
      when requested_state in ('approved', 'active', 'paused', 'suspended', 'rejected') then now()
      else null
    end,
    resolved_by = case
      when requested_state in ('approved', 'active', 'paused', 'suspended', 'rejected') then actor_id
      else null
    end,
    resolution_note = nullif(normalized_note, '')
  where user_id = target_user_id and requested_role = 'reviewer';

  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, previous_state, next_state, application_revision, note
  ) values (
    application_record.id, actor_id, 'reviewer_application.state_changed', previous_state, requested_state,
    application_record.revision, normalized_note
  );
  insert into public.authorization_events (actor_user_id, target_user_id, event_type, metadata)
  values (actor_id, target_user_id, 'reviewer.resolved', jsonb_build_object('state', requested_state));
  return jsonb_build_object('id', application_record.id, 'state', application_record.state);
end;
$$;

create or replace function public.activate_reviewer_application()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  application_record public.reviewer_applications;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into application_record
  from public.reviewer_applications
  where user_id = actor_id
  for update;
  if application_record.id is null
    or application_record.state <> 'approved'
    or application_record.current_policy_version <> 'reviewer-conduct-v1'
    or application_record.current_policy_agreed_at is null
    or application_record.conflict_declarations_confirmed_at is null
    or not exists (
      select 1 from public.role_capabilities capability
      where capability.user_id = actor_id
        and 'reviewer' = any(capability.capabilities)
        and capability.reviewer_approved_at is not null
    ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  update public.reviewer_applications
  set state = 'active', updated_at = now()
  where id = application_record.id
  returning * into application_record;
  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, previous_state, next_state, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.state_changed', 'approved', 'active', application_record.revision
  );
  insert into public.reviewer_application_events (
    application_id, actor_user_id, event_type, application_revision
  ) values (
    application_record.id, actor_id, 'reviewer_application.activated', application_record.revision
  );
  return jsonb_build_object('id', application_record.id, 'state', application_record.state);
end;
$$;

create or replace function public.is_reviewer_active_user(target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reviewer_applications application
    where application.user_id = target_user_id
      and application.state = 'active'
      and application.current_policy_version = 'reviewer-conduct-v1'
      and application.current_policy_agreed_at is not null
      and application.conflict_declarations_confirmed_at is not null
  )
$$;

create or replace function public.reviewer_is_eligible_for_workspace(
  requested_workspace_id uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.reviewer_applications application
    join public.reviewer_profiles profile on profile.application_id = application.id
    join public.project_workspaces workspace on workspace.id = requested_workspace_id
    join public.company_project_drafts project on project.id = workspace.project_id
    join public.active_contexts context on context.user_id = application.user_id
    join public.role_capabilities capability on capability.user_id = application.user_id
    where application.user_id = auth.uid()
      and application.state = 'active'
      and application.current_policy_version = 'reviewer-conduct-v1'
      and application.current_policy_agreed_at is not null
      and context.active_role = 'reviewer'
      and context.active_organization_id is null
      and 'reviewer' = any(capability.capabilities)
      and capability.reviewer_approved_at is not null
      and profile.availability_status in ('available', 'limited')
      and jsonb_array_length(project.required_skills) > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(project.required_skills) required_skill(skill_key)
        where not exists (
          select 1 from public.reviewer_profile_skills skill
          where skill.application_id = application.id
            and skill.is_current
            and skill.skill_key = required_skill.skill_key
        )
      )
      and not exists (
        select 1 from public.project_workspace_members member
        where member.workspace_id = workspace.id
          and member.user_id = application.user_id
          and member.role = 'talent_participant'
          and member.status = 'active'
      )
      and not exists (
        select 1 from public.project_workspace_submissions submission
        where submission.workspace_id = workspace.id
          and submission.talent_user_id = application.user_id
      )
      and not exists (
        select 1 from public.reviewer_conflict_declarations conflict
        where conflict.application_id = application.id
          and conflict.is_current
          and (
            conflict.scope = 'general'
            or conflict.organization_id = workspace.organization_id
          )
      )
      and (
        exists (
          select 1 from public.project_workspace_members existing_member
          where existing_member.workspace_id = workspace.id
            and existing_member.user_id = application.user_id
            and existing_member.role = 'reviewer'
            and existing_member.status = 'active'
            and existing_member.review_material_granted = true
        )
        or (
          select count(*)
          from public.project_workspace_members active_assignment
          join public.project_workspaces assigned_workspace on assigned_workspace.id = active_assignment.workspace_id
          where active_assignment.user_id = application.user_id
            and active_assignment.role = 'reviewer'
            and active_assignment.status = 'active'
            and active_assignment.review_material_granted = true
            and assigned_workspace.state not in ('completed', 'closed')
        ) < profile.max_concurrent_reviews
      )
  )
$$;

create or replace function public.get_reviewer_application()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', application.id,
    'state', application.state,
    'revision', application.revision,
    'resolution_note', application.resolution_note,
    'policy_version', application.current_policy_version,
    'policy_agreed_at', application.current_policy_agreed_at,
    'conflict_declarations_confirmed_at', application.conflict_declarations_confirmed_at,
    'submitted_at', application.submitted_at,
    'updated_at', application.updated_at,
    'profile', coalesce((
      select jsonb_build_object(
        'display_name', profile.display_name,
        'professional_focus', profile.professional_focus,
        'experience_context', profile.experience_context,
        'review_experience', profile.review_experience,
        'timezone', profile.timezone,
        'languages', to_jsonb(profile.languages),
        'availability_status', profile.availability_status,
        'max_concurrent_reviews', profile.max_concurrent_reviews,
        'feedback_style', profile.feedback_style,
        'public_bio', profile.public_bio
      ) from public.reviewer_profiles profile where profile.application_id = application.id
    ), '{}'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill_key', skill.skill_key, 'expertise_context', skill.expertise_context) order by skill.skill_key)
      from public.reviewer_profile_skills skill
      where skill.application_id = application.id and skill.is_current
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object('id', evidence.id, 'evidence_type', evidence.evidence_type, 'title', evidence.title, 'description', evidence.description, 'source_url', evidence.source_url) order by evidence.created_at asc)
      from public.reviewer_application_evidence evidence
      where evidence.application_id = application.id and evidence.is_current
    ), '[]'::jsonb),
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object('id', conflict.id, 'relationship_kind', conflict.relationship_kind, 'scope', conflict.scope, 'organization_id', conflict.organization_id, 'context', conflict.context) order by conflict.created_at asc)
      from public.reviewer_conflict_declarations conflict
      where conflict.application_id = application.id and conflict.is_current
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'previous_state', event.previous_state, 'next_state', event.next_state, 'note', event.note, 'occurred_at', event.occurred_at) order by event.occurred_at asc)
      from public.reviewer_application_events event
      where event.application_id = application.id
    ), '[]'::jsonb)
  )
  from public.reviewer_applications application
  where application.user_id = auth.uid()
$$;

create or replace function public.get_reviewer_admin_queue(maximum_count integer default 50)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.has_active_platform_administrator_context() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', application.id,
      'user_id', application.user_id,
      'state', application.state,
      'display_name', profile.display_name,
      'professional_focus', profile.professional_focus,
      'availability_status', profile.availability_status,
      'skill_keys', coalesce((
        select jsonb_agg(skill.skill_key order by skill.skill_key)
        from public.reviewer_profile_skills skill
        where skill.application_id = application.id and skill.is_current
      ), '[]'::jsonb),
      'policy_agreed_at', application.current_policy_agreed_at,
      'updated_at', application.updated_at
    ) order by application.updated_at asc, application.id)
    from (
      select * from public.reviewer_applications
      where state in ('in_screening', 'needs_more_evidence', 'approved', 'paused', 'suspended')
      order by updated_at asc, id
      limit least(greatest(coalesce(maximum_count, 0), 0), 100)
    ) application
    left join public.reviewer_profiles profile on profile.application_id = application.id
  ), '[]'::jsonb) else '[]'::jsonb end
$$;

create or replace function public.get_reviewer_admin_application(requested_application_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare target_user_id uuid;
begin
  if not public.has_active_platform_administrator_context() then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select user_id into target_user_id
  from public.reviewer_applications where id = requested_application_id;
  if target_user_id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return (
    select public.get_reviewer_application_for_user(target_user_id)
  );
end;
$$;

create or replace function public.get_reviewer_application_for_user(target_user_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', application.id,
    'user_id', application.user_id,
    'state', application.state,
    'revision', application.revision,
    'resolution_note', application.resolution_note,
    'policy_version', application.current_policy_version,
    'policy_agreed_at', application.current_policy_agreed_at,
    'conflict_declarations_confirmed_at', application.conflict_declarations_confirmed_at,
    'submitted_at', application.submitted_at,
    'updated_at', application.updated_at,
    'profile', coalesce((
      select jsonb_build_object(
        'display_name', profile.display_name,
        'professional_focus', profile.professional_focus,
        'experience_context', profile.experience_context,
        'review_experience', profile.review_experience,
        'timezone', profile.timezone,
        'languages', to_jsonb(profile.languages),
        'availability_status', profile.availability_status,
        'max_concurrent_reviews', profile.max_concurrent_reviews,
        'feedback_style', profile.feedback_style,
        'public_bio', profile.public_bio
      ) from public.reviewer_profiles profile where profile.application_id = application.id
    ), '{}'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object('skill_key', skill.skill_key, 'expertise_context', skill.expertise_context) order by skill.skill_key)
      from public.reviewer_profile_skills skill
      where skill.application_id = application.id and skill.is_current
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object('id', evidence.id, 'evidence_type', evidence.evidence_type, 'title', evidence.title, 'description', evidence.description, 'source_url', evidence.source_url) order by evidence.created_at asc)
      from public.reviewer_application_evidence evidence
      where evidence.application_id = application.id and evidence.is_current
    ), '[]'::jsonb),
    'conflicts', coalesce((
      select jsonb_agg(jsonb_build_object('id', conflict.id, 'relationship_kind', conflict.relationship_kind, 'scope', conflict.scope, 'organization_id', conflict.organization_id, 'context', conflict.context) order by conflict.created_at asc)
      from public.reviewer_conflict_declarations conflict
      where conflict.application_id = application.id and conflict.is_current
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'previous_state', event.previous_state, 'next_state', event.next_state, 'note', event.note, 'occurred_at', event.occurred_at) order by event.occurred_at asc)
      from public.reviewer_application_events event
      where event.application_id = application.id
    ), '[]'::jsonb)
  )
  from public.reviewer_applications application
  where application.user_id = target_user_id
$$;

create or replace function public.request_reviewer_capability()
returns public.capability_requests
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.capability_requests;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.reviewer_applications (user_id)
  values (actor_id)
  on conflict (user_id) do nothing;
  insert into public.capability_requests (user_id, requested_role, status)
  values (actor_id, 'reviewer', 'pending')
  on conflict (user_id, requested_role) do update set
    status = case when public.capability_requests.status in ('declined', 'withdrawn') then 'pending'::public.capability_request_status else public.capability_requests.status end,
    requested_at = case when public.capability_requests.status in ('declined', 'withdrawn') then now() else public.capability_requests.requested_at end,
    resolved_at = case when public.capability_requests.status in ('declined', 'withdrawn') then null else public.capability_requests.resolved_at end,
    resolved_by = case when public.capability_requests.status in ('declined', 'withdrawn') then null else public.capability_requests.resolved_by end,
    resolution_note = case when public.capability_requests.status in ('declined', 'withdrawn') then null else public.capability_requests.resolution_note end
  returning * into result;
  insert into public.authorization_events (actor_user_id, target_user_id, event_type)
  values (actor_id, actor_id, 'reviewer.requested');
  return result;
end;
$$;

create or replace function public.resolve_reviewer_capability(
  target_user_id uuid,
  approve boolean,
  resolution_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.resolve_reviewer_application(
    target_user_id,
    case when approve then 'approved'::public.reviewer_application_state else 'rejected'::public.reviewer_application_state end,
    coalesce(resolution_note, '')
  );
end;
$$;

create or replace function public.set_active_context(
  requested_role public.active_context_role,
  requested_organization_id uuid default null
)
returns public.active_contexts
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); updated_context public.active_contexts;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if requested_role = 'company_member' then
    if requested_organization_id is null or not public.is_active_organization_member(requested_organization_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  elsif requested_role = 'reviewer' then
    if requested_organization_id is not null
      or not public.is_reviewer_active_user(actor_id)
      or not exists (
        select 1 from public.role_capabilities capability
        where capability.user_id = actor_id and 'reviewer' = any(capability.capabilities) and capability.reviewer_approved_at is not null
      ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  elsif requested_role = 'administrator' then
    if requested_organization_id is not null or not public.is_platform_administrator() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  elsif requested_role = 'talent' then
    if requested_organization_id is not null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  end if;
  insert into public.active_contexts (user_id, active_role, active_organization_id)
  values (actor_id, requested_role, requested_organization_id)
  on conflict (user_id) do update set active_role = excluded.active_role, active_organization_id = excluded.active_organization_id, updated_at = now()
  returning * into updated_context;
  insert into public.authorization_events (actor_user_id, organization_id, event_type, metadata)
  values (actor_id, requested_organization_id, 'context.changed', jsonb_build_object('active_role', requested_role));
  return updated_context;
end;
$$;

create or replace function public.project_workspace_access_role(requested_workspace_id uuid)
returns public.project_workspace_member_role
language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.project_workspace_member_role;
begin
  if actor_id is null then return null; end if;
  select 'company_participant'::public.project_workspace_member_role into result
  from public.project_workspaces workspace
  join public.active_contexts context on context.user_id = actor_id
  where workspace.id = requested_workspace_id
    and context.active_role = 'company_member'
    and context.active_organization_id = workspace.organization_id
    and public.has_organization_permission(workspace.organization_id, 'hiring_member')
  limit 1;
  if result is not null then return result; end if;
  select member.role into result
  from public.project_workspace_members member
  join public.active_contexts context on context.user_id = actor_id
  where member.workspace_id = requested_workspace_id
    and member.user_id = actor_id
    and member.status = 'active'
    and (
      (member.role = 'talent_participant' and context.active_role = 'talent')
      or (
        member.role = 'reviewer'
        and context.active_role = 'reviewer'
        and member.review_material_granted = true
        and public.reviewer_is_eligible_for_workspace(requested_workspace_id)
      )
    )
  order by case member.role when 'talent_participant' then 1 else 2 end
  limit 1;
  return result;
end;
$$;

revoke all on table public.reviewer_applications, public.reviewer_profiles, public.reviewer_profile_skills, public.reviewer_application_evidence, public.reviewer_conflict_declarations, public.reviewer_policy_agreements, public.reviewer_application_events from public, anon, authenticated;
grant select on table public.reviewer_applications, public.reviewer_profiles, public.reviewer_profile_skills, public.reviewer_application_evidence, public.reviewer_conflict_declarations, public.reviewer_policy_agreements, public.reviewer_application_events to authenticated;

revoke all on function public.has_active_platform_administrator_context(), public.reviewer_application_payload_is_valid(jsonb, jsonb, jsonb, jsonb), public.reviewer_profile_is_submittable(uuid), public.reviewer_admin_transition_is_valid(public.reviewer_application_state, public.reviewer_application_state), public.is_reviewer_active_user(uuid), public.reviewer_is_eligible_for_workspace(uuid), public.get_reviewer_application_for_user(uuid) from public, anon, authenticated;
revoke all on function public.save_reviewer_application(jsonb, jsonb, jsonb, jsonb), public.submit_reviewer_application(boolean, boolean), public.resolve_reviewer_application(uuid, public.reviewer_application_state, text), public.activate_reviewer_application(), public.get_reviewer_application(), public.get_reviewer_admin_queue(integer), public.get_reviewer_admin_application(uuid), public.request_reviewer_capability(), public.resolve_reviewer_capability(uuid, boolean, text), public.set_active_context(public.active_context_role, uuid), public.project_workspace_access_role(uuid) from public, anon;
grant execute on function public.save_reviewer_application(jsonb, jsonb, jsonb, jsonb), public.submit_reviewer_application(boolean, boolean), public.activate_reviewer_application(), public.get_reviewer_application(), public.get_reviewer_admin_queue(integer), public.get_reviewer_admin_application(uuid), public.request_reviewer_capability(), public.resolve_reviewer_capability(uuid, boolean, text), public.set_active_context(public.active_context_role, uuid), public.project_workspace_access_role(uuid) to authenticated;
grant execute on function public.resolve_reviewer_application(uuid, public.reviewer_application_state, text) to authenticated;
