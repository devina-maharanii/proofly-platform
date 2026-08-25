-- Owner: Identity and access module. Risk: private personal settings and data-rights requests. Rollback: disable settings route; retain private requests and audit history.

create type public.data_rights_request_type as enum ('export', 'deletion');
create type public.data_rights_request_status as enum ('requested', 'cancelled', 'scheduled');

create table public.personal_settings (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  preferred_language text not null default 'en' check (preferred_language in ('en')),
  timezone text not null default 'UTC' check (char_length(timezone) <= 80),
  short_bio text not null default '' check (char_length(short_bio) <= 280),
  profile_visibility text not null default 'private' check (profile_visibility in ('private', 'public')),
  proof_visibility_default text not null default 'private' check (proof_visibility_default in ('private', 'restricted')),
  portfolio_visibility text not null default 'private' check (portfolio_visibility in ('private', 'public')),
  contact_visibility text not null default 'private' check (contact_visibility in ('private', 'public')),
  membership_visibility text not null default 'private' check (membership_visibility in ('private', 'public')),
  search_discoverability boolean not null default false,
  data_sharing boolean not null default false,
  notification_preferences jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(notification_preferences) = 'object')
);

create table public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  request_type public.data_rights_request_type not null,
  status public.data_rights_request_status not null default 'requested',
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz,
  cancelled_at timestamptz,
  check ((status = 'scheduled') = (scheduled_for is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);

create unique index data_rights_one_open_request_per_type_idx
  on public.data_rights_requests (user_id, request_type)
  where status in ('requested', 'scheduled');

create table public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'account.settings_saved', 'account.privacy_saved', 'account.notifications_saved',
    'account.password_changed', 'account.sessions_revoked', 'account.identity_unlinked',
    'account.export_requested', 'account.deletion_requested', 'account.deletion_cancelled'
  )),
  occurred_at timestamptz not null default now()
);

create index account_security_events_actor_occurred_idx
  on public.account_security_events (actor_user_id, occurred_at desc);

alter table public.personal_settings enable row level security;
alter table public.data_rights_requests enable row level security;
alter table public.account_security_events enable row level security;

create policy "people can view their private settings" on public.personal_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "people can view their data rights requests" on public.data_rights_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "people can view their security events" on public.account_security_events for select to authenticated
  using ((select auth.uid()) = actor_user_id);

create or replace function public.save_personal_settings(requested_settings jsonb)
returns public.personal_settings
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  result public.personal_settings;
  allowed_keys text[] := array[
    'display_name','avatar_url','preferred_language','timezone','short_bio',
    'profile_visibility','proof_visibility_default','portfolio_visibility','contact_visibility',
    'membership_visibility','search_discoverability','data_sharing','notification_preferences'
  ];
begin
  if actor_id is null or jsonb_typeof(requested_settings) <> 'object'
     or exists (select 1 from jsonb_object_keys(requested_settings) key where key <> all(allowed_keys)) then
    raise exception 'VALIDATION_FAILED';
  end if;

  insert into public.personal_settings (
    user_id, display_name, avatar_url, preferred_language, timezone, short_bio,
    profile_visibility, proof_visibility_default, portfolio_visibility, contact_visibility,
    membership_visibility, search_discoverability, data_sharing, notification_preferences
  ) values (
    actor_id,
    left(coalesce(requested_settings->>'display_name',''),80),
    left(coalesce(requested_settings->>'avatar_url',''),500),
    coalesce(requested_settings->>'preferred_language','en'),
    left(coalesce(requested_settings->>'timezone','UTC'),80),
    left(coalesce(requested_settings->>'short_bio',''),280),
    coalesce(requested_settings->>'profile_visibility','private'),
    coalesce(requested_settings->>'proof_visibility_default','private'),
    coalesce(requested_settings->>'portfolio_visibility','private'),
    coalesce(requested_settings->>'contact_visibility','private'),
    coalesce(requested_settings->>'membership_visibility','private'),
    coalesce((requested_settings->>'search_discoverability')::boolean,false),
    coalesce((requested_settings->>'data_sharing')::boolean,false),
    coalesce(requested_settings->'notification_preferences','{}'::jsonb)
  ) on conflict (user_id) do update set
    display_name = excluded.display_name, avatar_url = excluded.avatar_url,
    preferred_language = excluded.preferred_language, timezone = excluded.timezone,
    short_bio = excluded.short_bio, profile_visibility = excluded.profile_visibility,
    proof_visibility_default = excluded.proof_visibility_default,
    portfolio_visibility = excluded.portfolio_visibility, contact_visibility = excluded.contact_visibility,
    membership_visibility = excluded.membership_visibility,
    search_discoverability = excluded.search_discoverability, data_sharing = excluded.data_sharing,
    notification_preferences = excluded.notification_preferences,
    version = public.personal_settings.version + 1, updated_at = now()
  returning * into result;

  insert into public.account_security_events (actor_user_id, event_type)
  values (actor_id, 'account.settings_saved');
  return result;
end;
$$;

create or replace function public.request_data_right(request_type public.data_rights_request_type)
returns public.data_rights_requests
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.data_rights_requests;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  insert into public.data_rights_requests (user_id, request_type, status, scheduled_for)
  values (
    actor_id,
    request_type,
    case when request_type = 'deletion' then 'scheduled' else 'requested' end,
    case when request_type = 'deletion' then now() + interval '14 days' else null end
  )
  on conflict (user_id, request_type) where status in ('requested', 'scheduled') do update
    set requested_at = public.data_rights_requests.requested_at
  returning * into result;
  insert into public.account_security_events (actor_user_id, event_type)
  values (actor_id, case when request_type = 'export' then 'account.export_requested' else 'account.deletion_requested' end);
  return result;
end;
$$;

create or replace function public.record_account_security_event(requested_event text)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or requested_event not in ('account.password_changed','account.sessions_revoked','account.identity_unlinked') then
    raise exception 'VALIDATION_FAILED';
  end if;
  insert into public.account_security_events (actor_user_id, event_type) values (actor_id, requested_event);
end;
$$;

revoke all on function public.save_personal_settings(jsonb) from public, anon;
revoke all on function public.request_data_right(public.data_rights_request_type) from public, anon;
revoke all on function public.record_account_security_event(text) from public, anon;
grant execute on function public.save_personal_settings(jsonb) to authenticated;
grant execute on function public.request_data_right(public.data_rights_request_type) to authenticated;
grant execute on function public.record_account_security_event(text) to authenticated;
