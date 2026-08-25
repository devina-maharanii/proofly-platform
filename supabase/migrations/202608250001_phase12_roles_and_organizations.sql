-- Proofly Phase 12: explicit user capabilities, organization memberships, active context, controlled elevation, and RLS.
-- Owner: Organizations and memberships module. Risk: authorization scope. Rollback: disable feature routes, retain auditable membership history.

create extension if not exists pgcrypto;

create type public.platform_role as enum ('talent', 'reviewer', 'administrator');
create type public.active_context_role as enum ('talent', 'company_member', 'reviewer', 'administrator');
create type public.membership_status as enum ('invited', 'active', 'removed');
create type public.company_permission as enum ('owner', 'hiring_member', 'reviewer_member', 'billing_member', 'viewer');
create type public.capability_request_status as enum ('pending', 'approved', 'declined', 'withdrawn');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status public.membership_status not null default 'invited',
  permissions public.company_permission[] not null default array['viewer']::public.company_permission[],
  joined_at timestamptz,
  removed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  check (cardinality(permissions) > 0),
  check ((status = 'active') = (joined_at is not null)),
  check ((status = 'removed') = (removed_at is not null))
);

create index organization_memberships_user_active_idx
  on public.organization_memberships (user_id, organization_id)
  where status = 'active';

create table public.role_capabilities (
  user_id uuid primary key references auth.users(id) on delete restrict,
  capabilities public.platform_role[] not null default array[]::public.platform_role[],
  reviewer_approved_at timestamptz,
  administrator_granted_at timestamptz,
  granted_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (
    not ('reviewer' = any(capabilities))
    or reviewer_approved_at is not null
  ),
  check (
    not ('administrator' = any(capabilities))
    or (administrator_granted_at is not null and granted_by is not null)
  )
);

create table public.capability_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_role public.platform_role not null check (requested_role = 'reviewer'),
  status public.capability_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text,
  unique (user_id, requested_role),
  check ((status in ('approved', 'declined')) = (resolved_at is not null)),
  check ((status in ('approved', 'declined')) = (resolved_by is not null))
);

create table public.active_contexts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_role public.active_context_role not null,
  active_organization_id uuid references public.organizations(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    (active_role = 'company_member' and active_organization_id is not null)
    or (active_role <> 'company_member' and active_organization_id is null)
  )
);

create table public.authorization_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  event_type text not null check (event_type in ('context.changed', 'membership.updated', 'reviewer.requested', 'reviewer.resolved', 'administrator.granted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index authorization_events_actor_created_idx
  on public.authorization_events (actor_user_id, created_at desc);

create or replace function public.is_active_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.has_organization_permission(
  target_organization_id uuid,
  required_permission public.company_permission
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and (
        'owner' = any(membership.permissions)
        or required_permission = any(membership.permissions)
      )
  );
$$;

create or replace function public.is_platform_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_capabilities role_capability
    where role_capability.user_id = auth.uid()
      and 'administrator' = any(role_capability.capabilities)
      and role_capability.administrator_granted_at is not null
  );
$$;

revoke all on function public.is_active_organization_member(uuid) from public;
revoke all on function public.has_organization_permission(uuid, public.company_permission) from public;
revoke all on function public.is_platform_administrator() from public;
grant execute on function public.is_active_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_permission(uuid, public.company_permission) to authenticated;
grant execute on function public.is_platform_administrator() to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.capability_requests enable row level security;
alter table public.active_contexts enable row level security;
alter table public.authorization_events enable row level security;

create policy "organization members can view their organizations"
  on public.organizations for select to authenticated
  using (public.is_active_organization_member(id));

create policy "members can view their own membership"
  on public.organization_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_organization_permission(organization_id, 'owner')
  );

create policy "users can view their own capabilities"
  on public.role_capabilities for select to authenticated
  using (user_id = auth.uid());

create policy "users can view their own capability requests"
  on public.capability_requests for select to authenticated
  using (user_id = auth.uid() or public.is_platform_administrator());

create policy "users can view their own active context"
  on public.active_contexts for select to authenticated
  using (user_id = auth.uid());

create policy "actors can view their authorization events"
  on public.authorization_events for select to authenticated
  using (
    actor_user_id = auth.uid()
    or target_user_id = auth.uid()
    or (organization_id is not null and public.has_organization_permission(organization_id, 'owner'))
    or public.is_platform_administrator()
  );

create or replace function public.set_active_context(
  requested_role public.active_context_role,
  requested_organization_id uuid default null
)
returns public.active_contexts
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  updated_context public.active_contexts;
begin
  if actor_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if requested_role = 'company_member' then
    if requested_organization_id is null
       or not public.is_active_organization_member(requested_organization_id) then
      raise exception 'NOT_FOUND_OR_PRIVATE';
    end if;
  elsif requested_role = 'reviewer' then
    if requested_organization_id is not null
       or not exists (
         select 1 from public.role_capabilities capability
         where capability.user_id = actor_id
           and 'reviewer' = any(capability.capabilities)
           and capability.reviewer_approved_at is not null
       ) then
      raise exception 'NOT_FOUND_OR_PRIVATE';
    end if;
  elsif requested_role = 'administrator' then
    if requested_organization_id is not null or not public.is_platform_administrator() then
      raise exception 'NOT_FOUND_OR_PRIVATE';
    end if;
  elsif requested_role = 'talent' then
    if requested_organization_id is not null then
      raise exception 'NOT_FOUND_OR_PRIVATE';
    end if;
  end if;

  insert into public.active_contexts (user_id, active_role, active_organization_id)
  values (actor_id, requested_role, requested_organization_id)
  on conflict (user_id) do update
    set active_role = excluded.active_role,
        active_organization_id = excluded.active_organization_id,
        updated_at = now()
  returning * into updated_context;

  insert into public.authorization_events (actor_user_id, organization_id, event_type, metadata)
  values (
    actor_id,
    requested_organization_id,
    'context.changed',
    jsonb_build_object('active_role', requested_role)
  );

  return updated_context;
end;
$$;

create or replace function public.request_reviewer_capability()
returns public.capability_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  result public.capability_requests;
begin
  if actor_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

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
    end
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
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_administrator() then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  update public.capability_requests
  set status = case when approve then 'approved'::public.capability_request_status else 'declined'::public.capability_request_status end,
      resolved_at = now(),
      resolved_by = actor_id,
      resolution_note = left(nullif(trim(resolution_note), ''), 500)
  where user_id = target_user_id
    and requested_role = 'reviewer'
    and status = 'pending';

  if approve then
    insert into public.role_capabilities (user_id, capabilities, reviewer_approved_at, granted_by)
    values (target_user_id, array['reviewer']::public.platform_role[], now(), actor_id)
    on conflict (user_id) do update
      set capabilities = array(select distinct role from unnest(public.role_capabilities.capabilities || excluded.capabilities) as role),
          reviewer_approved_at = excluded.reviewer_approved_at,
          granted_by = excluded.granted_by,
          updated_at = now();
  end if;

  insert into public.authorization_events (actor_user_id, target_user_id, event_type, metadata)
  values (actor_id, target_user_id, 'reviewer.resolved', jsonb_build_object('approved', approve));
end;
$$;

create or replace function public.grant_administrator_capability(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_platform_administrator() then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;

  insert into public.role_capabilities (user_id, capabilities, administrator_granted_at, granted_by)
  values (target_user_id, array['administrator']::public.platform_role[], now(), actor_id)
  on conflict (user_id) do update
    set capabilities = array(select distinct role from unnest(public.role_capabilities.capabilities || excluded.capabilities) as role),
        administrator_granted_at = excluded.administrator_granted_at,
        granted_by = excluded.granted_by,
        updated_at = now();

  insert into public.authorization_events (actor_user_id, target_user_id, event_type)
  values (actor_id, target_user_id, 'administrator.granted');
end;
$$;

revoke all on function public.set_active_context(public.active_context_role, uuid) from public;
revoke all on function public.request_reviewer_capability() from public;
revoke all on function public.resolve_reviewer_capability(uuid, boolean, text) from public;
revoke all on function public.grant_administrator_capability(uuid) from public;
grant execute on function public.set_active_context(public.active_context_role, uuid) to authenticated;
grant execute on function public.request_reviewer_capability() to authenticated;
grant execute on function public.resolve_reviewer_capability(uuid, boolean, text) to authenticated;
grant execute on function public.grant_administrator_capability(uuid) to authenticated;
