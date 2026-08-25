-- Owner: Identity and onboarding module. Risk: private onboarding drafts and organization creation. Rollback: disable onboarding routes and retain private draft/audit history.

create type public.onboarding_state as enum (
  'not_started',
  'in_progress',
  'ready_for_workspace',
  'needs_review',
  'completed'
);

create table public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.active_context_role not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  state public.onboarding_state not null default 'not_started',
  draft jsonb not null default '{}'::jsonb,
  skipped_fields text[] not null default array[]::text[],
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, organization_id),
  check (role in ('talent', 'company_member', 'reviewer')),
  check (
    (role = 'company_member' and organization_id is not null)
    or (role <> 'company_member' and organization_id is null)
  ),
  check (jsonb_typeof(draft) = 'object'),
  check (cardinality(skipped_fields) <= 8),
  check ((state = 'completed') = (completed_at is not null))
);

create index onboarding_progress_user_context_idx
  on public.onboarding_progress (user_id, role, organization_id);

create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboarding_progress(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  role public.active_context_role not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  event_type text not null check (
    event_type in (
      'onboarding.company_started',
      'onboarding.draft_saved',
      'onboarding.ready_for_workspace',
      'onboarding.completed',
      'onboarding.reviewer_requested'
    )
  ),
  step_key text check (step_key is null or step_key ~ '^[a-z_]{1,40}$'),
  occurred_at timestamptz not null default now(),
  check (
    (role = 'company_member' and organization_id is not null)
    or (role <> 'company_member' and organization_id is null)
  )
);

create index onboarding_events_actor_occurred_idx
  on public.onboarding_events (actor_user_id, occurred_at desc);

alter table public.onboarding_progress enable row level security;
alter table public.onboarding_events enable row level security;

create policy "people can view their private onboarding progress"
  on public.onboarding_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "people can view their private onboarding events"
  on public.onboarding_events for select to authenticated
  using ((select auth.uid()) = actor_user_id);

create or replace function public.start_company_onboarding(
  requested_organization_name text,
  requested_organization_slug text
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  created_organization public.organizations;
  result public.onboarding_progress;
begin
  if actor_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if char_length(trim(coalesce(requested_organization_name, ''))) not between 2 and 120
     or coalesce(requested_organization_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'VALIDATION_FAILED';
  end if;

  begin
    insert into public.organizations (name, slug, created_by)
    values (
      left(trim(requested_organization_name), 120),
      left(requested_organization_slug, 120),
      actor_id
    )
    returning * into created_organization;
  exception when unique_violation then
    raise exception 'CONFLICT';
  end;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    status,
    permissions,
    joined_at,
    created_by
  )
  values (
    created_organization.id,
    actor_id,
    'active',
    array['owner']::public.company_permission[],
    now(),
    actor_id
  );

  insert into public.active_contexts (user_id, active_role, active_organization_id)
  values (actor_id, 'company_member', created_organization.id)
  on conflict (user_id) do update
    set active_role = excluded.active_role,
        active_organization_id = excluded.active_organization_id,
        updated_at = now();

  insert into public.onboarding_progress (user_id, role, organization_id, state)
  values (actor_id, 'company_member', created_organization.id, 'in_progress')
  returning * into result;

  insert into public.authorization_events (actor_user_id, organization_id, event_type, metadata)
  values (
    actor_id,
    created_organization.id,
    'context.changed',
    jsonb_build_object('active_role', 'company_member', 'source', 'onboarding')
  );

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type
  )
  values (
    result.id,
    actor_id,
    'company_member',
    created_organization.id,
    'onboarding.company_started'
  );

  return result;
end;
$$;

create or replace function public.save_onboarding_draft(
  requested_role public.active_context_role,
  requested_organization_id uuid,
  requested_draft jsonb,
  requested_skipped_fields text[] default array[]::text[],
  requested_state public.onboarding_state default 'in_progress',
  requested_step_key text default null
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.onboarding_progress;
  valid_keys text[] := array[
    'full_name', 'display_name', 'primary_purpose', 'timezone', 'locale',
    'notification_email', 'notification_product', 'developer_focus',
    'experience_level', 'goals', 'portfolio_url', 'availability',
    'company_size', 'hiring_stage', 'hiring_focus', 'company_member_role',
    'company_first_action', 'expertise_areas', 'experience_evidence'
  ];
begin
  if actor_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if requested_role not in ('talent', 'company_member')
     or requested_state not in ('in_progress', 'ready_for_workspace')
     or jsonb_typeof(requested_draft) <> 'object'
     or cardinality(requested_skipped_fields) > 8
     or (requested_step_key is not null and requested_step_key !~ '^[a-z_]{1,40}$')
     or exists (
       select 1
       from jsonb_object_keys(requested_draft) as key
       where key <> all(valid_keys)
     )
     or exists (
       select 1
       from unnest(requested_skipped_fields) as skipped_field
       where skipped_field <> 'portfolio_url'
     ) then
    raise exception 'VALIDATION_FAILED';
  end if;

  if requested_role = 'company_member' then
    if requested_organization_id is null
       or not public.is_active_organization_member(requested_organization_id)
       or not exists (
         select 1
         from public.active_contexts active_context
         where active_context.user_id = actor_id
           and active_context.active_role = 'company_member'
           and active_context.active_organization_id = requested_organization_id
       ) then
      raise exception 'NOT_FOUND_OR_PRIVATE';
    end if;
  elsif requested_organization_id is not null
     or not exists (
       select 1
       from public.active_contexts active_context
       where active_context.user_id = actor_id
         and active_context.active_role = 'talent'
         and active_context.active_organization_id is null
     ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  insert into public.onboarding_progress (
    user_id,
    role,
    organization_id,
    state,
    draft,
    skipped_fields
  )
  values (
    actor_id,
    requested_role,
    requested_organization_id,
    requested_state,
    requested_draft,
    requested_skipped_fields
  )
  on conflict (user_id, role, organization_id) do update
    set state = excluded.state,
        draft = excluded.draft,
        skipped_fields = excluded.skipped_fields,
        updated_at = now()
  returning * into result;

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type,
    step_key
  )
  values (
    result.id,
    actor_id,
    requested_role,
    requested_organization_id,
    case
      when requested_state = 'ready_for_workspace' then 'onboarding.ready_for_workspace'
      else 'onboarding.draft_saved'
    end,
    requested_step_key
  );

  return result;
end;
$$;

create or replace function public.complete_onboarding(
  requested_role public.active_context_role,
  requested_organization_id uuid,
  requested_draft jsonb,
  requested_skipped_fields text[] default array[]::text[]
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.onboarding_progress;
  selected_member_role public.company_permission;
begin
  if actor_id is null
     or requested_role not in ('talent', 'company_member')
     or nullif(trim(coalesce(requested_draft ->> 'full_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'display_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'primary_purpose', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'timezone', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'locale', '')), '') is null then
    raise exception 'VALIDATION_FAILED';
  end if;

  perform public.save_onboarding_draft(
    requested_role,
    requested_organization_id,
    requested_draft,
    requested_skipped_fields,
    'ready_for_workspace',
    'review'
  );

  if requested_role = 'talent' then
    if nullif(trim(coalesce(requested_draft ->> 'developer_focus', '')), '') is null
       or nullif(trim(coalesce(requested_draft ->> 'experience_level', '')), '') is null
       or jsonb_typeof(requested_draft -> 'goals') <> 'array'
       or jsonb_array_length(requested_draft -> 'goals') = 0
       or nullif(trim(coalesce(requested_draft ->> 'availability', '')), '') is null then
      raise exception 'VALIDATION_FAILED';
    end if;
  else
    if nullif(trim(coalesce(requested_draft ->> 'company_size', '')), '') is null
       or nullif(trim(coalesce(requested_draft ->> 'hiring_stage', '')), '') is null
       or nullif(trim(coalesce(requested_draft ->> 'hiring_focus', '')), '') is null
       or nullif(trim(coalesce(requested_draft ->> 'company_member_role', '')), '') is null
       or nullif(trim(coalesce(requested_draft ->> 'company_first_action', '')), '') is null then
      raise exception 'VALIDATION_FAILED';
    end if;

    selected_member_role := (requested_draft ->> 'company_member_role')::public.company_permission;
    update public.organization_memberships
    set permissions = case
      when selected_member_role = 'owner' then array['owner']::public.company_permission[]
      else array['owner', selected_member_role]::public.company_permission[]
    end,
        updated_at = now()
    where organization_id = requested_organization_id
      and user_id = actor_id
      and status = 'active';
  end if;

  update public.onboarding_progress
  set state = 'completed',
      completed_at = now(),
      updated_at = now()
  where user_id = actor_id
    and role = requested_role
    and organization_id is not distinct from requested_organization_id
  returning * into result;

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type
  )
  values (
    result.id,
    actor_id,
    requested_role,
    requested_organization_id,
    'onboarding.completed'
  );

  return result;
end;
$$;

create or replace function public.complete_reviewer_onboarding(
  requested_draft jsonb,
  requested_skipped_fields text[] default array[]::text[]
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.onboarding_progress;
begin
  if actor_id is null
     or jsonb_typeof(requested_draft) <> 'object'
     or nullif(trim(coalesce(requested_draft ->> 'full_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'display_name', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'primary_purpose', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'timezone', '')), '') is null
     or nullif(trim(coalesce(requested_draft ->> 'locale', '')), '') is null
     or jsonb_typeof(requested_draft -> 'expertise_areas') <> 'array'
     or jsonb_array_length(requested_draft -> 'expertise_areas') = 0
     or nullif(trim(coalesce(requested_draft ->> 'experience_evidence', '')), '') is null
     or cardinality(requested_skipped_fields) > 8 then
    raise exception 'VALIDATION_FAILED';
  end if;

  insert into public.onboarding_progress (
    user_id,
    role,
    organization_id,
    state,
    draft,
    skipped_fields
  )
  values (
    actor_id,
    'reviewer',
    null,
    'needs_review',
    requested_draft,
    requested_skipped_fields
  )
  on conflict (user_id, role, organization_id) do update
    set state = 'needs_review',
        draft = excluded.draft,
        skipped_fields = excluded.skipped_fields,
        completed_at = null,
        updated_at = now()
  returning * into result;

  insert into public.capability_requests (user_id, requested_role, status)
  values (actor_id, 'reviewer', 'pending')
  on conflict (user_id, requested_role) do update
    set status = case
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

  insert into public.authorization_events (actor_user_id, target_user_id, event_type)
  values (actor_id, actor_id, 'reviewer.requested');

  insert into public.onboarding_events (
    onboarding_id,
    actor_user_id,
    role,
    organization_id,
    event_type
  )
  values (
    result.id,
    actor_id,
    'reviewer',
    null,
    'onboarding.reviewer_requested'
  );

  return result;
end;
$$;

revoke all on function public.start_company_onboarding(text, text) from public, anon;
revoke all on function public.save_onboarding_draft(public.active_context_role, uuid, jsonb, text[], public.onboarding_state, text) from public, anon;
revoke all on function public.complete_onboarding(public.active_context_role, uuid, jsonb, text[]) from public, anon;
revoke all on function public.complete_reviewer_onboarding(jsonb, text[]) from public, anon;

grant execute on function public.start_company_onboarding(text, text) to authenticated;
grant execute on function public.save_onboarding_draft(public.active_context_role, uuid, jsonb, text[], public.onboarding_state, text) to authenticated;
grant execute on function public.complete_onboarding(public.active_context_role, uuid, jsonb, text[]) to authenticated;
grant execute on function public.complete_reviewer_onboarding(jsonb, text[]) to authenticated;
