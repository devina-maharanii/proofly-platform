-- Phase 19 — GitHub Integration
-- Owner: Proofly Platform. Risk: provider connection and public snapshot visibility.
-- Rollback: forward compensation only; revoke connection, delete ciphertext/snapshots,
-- and retain minimal append-only event history. No OAuth secret is stored in this schema.

create type public.github_connection_status as enum (
  'pending_authorization', 'importing', 'connected', 'partially_synced',
  'rate_limited', 'failed', 'revoked'
);

create type public.github_sync_kind as enum ('initial', 'manual');
create type public.github_sync_status as enum (
  'queued', 'running', 'succeeded', 'partial', 'rate_limited', 'failed', 'revoked'
);

create table public.github_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  encrypted_payload text not null check (char_length(encrypted_payload) between 40 and 4000),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '15 minutes')
);

create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  github_user_id bigint unique,
  github_login text not null default '' check (char_length(github_login) <= 39),
  github_profile_url text not null default '' check (github_profile_url = '' or github_profile_url ~ '^https://github\.com/'),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500 and (avatar_url = '' or avatar_url ~ '^https://')),
  encrypted_access_token text,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  consented_at timestamptz,
  status public.github_connection_status not null default 'pending_authorization',
  last_synced_at timestamptz,
  retry_after_at timestamptz,
  failure_code text not null default '' check (failure_code in ('', 'provider_unavailable', 'unexpected_scope', 'authorization_denied', 'token_invalid', 'rate_limited', 'partial_failure', 'configuration_unavailable')),
  revoked_at timestamptz,
  data_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'revoked' and revoked_at is not null and encrypted_access_token is null and encrypted_refresh_token is null)
    or status <> 'revoked'
  )
);

create table public.github_repository_snapshots (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.github_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  github_repository_id bigint not null,
  repository_name text not null check (char_length(repository_name) between 1 and 100),
  full_name text not null check (char_length(full_name) between 3 and 200),
  source_url text not null check (source_url ~ '^https://github\.com/'),
  description text not null default '' check (char_length(description) <= 500),
  primary_language text not null default '' check (char_length(primary_language) <= 100),
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array' and jsonb_array_length(topics) <= 20),
  contribution_context text not null default 'Public repository selected by the Talent.' check (char_length(contribution_context) <= 300),
  is_fork boolean not null default false,
  is_archived boolean not null default false,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  source_pushed_at timestamptz,
  source_synced_at timestamptz not null default now(),
  selected_public boolean not null default false,
  hidden_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, github_repository_id),
  check ((removed_at is null) or selected_public = false)
);

create table public.github_repository_exclusions (
  connection_id uuid not null references public.github_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  github_repository_id bigint not null,
  removed_at timestamptz not null default now(),
  primary key (connection_id, github_repository_id)
);

create table public.github_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.github_connections(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  sync_kind public.github_sync_kind not null,
  idempotency_key uuid not null,
  status public.github_sync_status not null default 'queued',
  repositories_seen integer not null default 0 check (repositories_seen >= 0 and repositories_seen <= 100),
  repositories_imported integer not null default 0 check (repositories_imported >= 0 and repositories_imported <= 100),
  failure_code text not null default '' check (failure_code in ('', 'provider_unavailable', 'token_invalid', 'rate_limited', 'partial_failure', 'configuration_unavailable')),
  retry_after_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, idempotency_key)
);

create table public.github_integration_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.github_connections(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'github.authorization_started', 'github.connected', 'github.initial_sync_queued',
    'github.manual_sync_queued', 'github.sync_succeeded', 'github.sync_partial',
    'github.sync_rate_limited', 'github.sync_failed', 'github.repository_selected',
    'github.repository_hidden', 'github.repository_removed', 'github.disconnected'
  )),
  occurred_at timestamptz not null default now()
);

create index github_oauth_attempts_expiry_idx on public.github_oauth_attempts(expires_at) where consumed_at is null;
create index github_repository_snapshots_owner_idx on public.github_repository_snapshots(user_id, source_synced_at desc);
create index github_repository_snapshots_public_idx on public.github_repository_snapshots(user_id, selected_public, source_synced_at desc) where removed_at is null;
create index github_repository_exclusions_owner_idx on public.github_repository_exclusions(user_id, removed_at desc);
create index github_sync_runs_connection_idx on public.github_sync_runs(connection_id, created_at desc);
create index github_integration_events_owner_idx on public.github_integration_events(user_id, occurred_at desc);

alter table public.github_oauth_attempts enable row level security;
alter table public.github_connections enable row level security;
alter table public.github_repository_snapshots enable row level security;
alter table public.github_repository_exclusions enable row level security;
alter table public.github_sync_runs enable row level security;
alter table public.github_integration_events enable row level security;

-- No direct authenticated-table policies are granted. OAuth state and encrypted
-- token fields never cross the browser database boundary; the safe owner reader
-- below is the only authenticated projection for this module.
create or replace function public.get_own_github_integration_context()
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_build_object(
    'status', connection.status,
    'github_login', connection.github_login,
    'github_profile_url', connection.github_profile_url,
    'avatar_url', connection.avatar_url,
    'consented_at', connection.consented_at,
    'last_synced_at', connection.last_synced_at,
    'retry_after_at', connection.retry_after_at,
    'failure_code', connection.failure_code,
    'repositories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', repository.id,
        'repository_name', repository.repository_name,
        'full_name', repository.full_name,
        'source_url', repository.source_url,
        'description', repository.description,
        'primary_language', repository.primary_language,
        'topics', repository.topics,
        'contribution_context', repository.contribution_context,
        'is_fork', repository.is_fork,
        'is_archived', repository.is_archived,
        'source_updated_at', repository.source_updated_at,
        'source_synced_at', repository.source_synced_at,
        'selected_public', repository.selected_public
      ) order by repository.source_updated_at desc nulls last, repository.repository_name)
      from public.github_repository_snapshots repository
      where repository.connection_id = connection.id and repository.removed_at is null
    ), '[]'::jsonb),
    'latest_sync', (
      select jsonb_build_object(
        'id', run.id,
        'sync_kind', run.sync_kind,
        'status', run.status,
        'repositories_seen', run.repositories_seen,
        'repositories_imported', run.repositories_imported,
        'failure_code', run.failure_code,
        'retry_after_at', run.retry_after_at,
        'created_at', run.created_at,
        'completed_at', run.completed_at
      )
      from public.github_sync_runs run
      where run.connection_id = connection.id
      order by run.created_at desc
      limit 1
    )
  ), '{}'::jsonb)
  from public.github_connections connection
  where connection.user_id = public.require_active_talent_evidence_actor()
$$;

create or replace function public.get_public_talent_github_context(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_build_object(
    'source', 'github',
    'context_status', 'not_verified',
    'username', connection.github_login,
    'profile_url', connection.github_profile_url,
    'avatar_url', connection.avatar_url,
    'last_synced_at', connection.last_synced_at,
    'repositories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', repository.repository_name,
        'full_name', repository.full_name,
        'source_url', repository.source_url,
        'description', repository.description,
        'primary_language', repository.primary_language,
        'topics', repository.topics,
        'contribution_context', repository.contribution_context,
        'is_fork', repository.is_fork,
        'is_archived', repository.is_archived,
        'source_updated_at', repository.source_updated_at,
        'source_synced_at', repository.source_synced_at,
        'source', 'github',
        'context_status', 'not_verified'
      ) order by repository.source_updated_at desc nulls last, repository.repository_name)
      from public.github_repository_snapshots repository
      where repository.connection_id = connection.id
        and repository.selected_public
        and repository.removed_at is null
    ), '[]'::jsonb)
  ), '{}'::jsonb)
  from public.talent_profile_publications profile
  join public.github_connections connection
    on connection.user_id = profile.user_id
   and connection.status in ('connected', 'partially_synced')
   and connection.revoked_at is null
  where profile.handle = lower(trim(requested_handle))
    and profile.state = 'published'
    and exists (
      select 1 from public.github_repository_snapshots repository
      where repository.connection_id = connection.id
        and repository.selected_public
        and repository.removed_at is null
    )
$$;

revoke all on table public.github_oauth_attempts, public.github_connections, public.github_repository_snapshots, public.github_repository_exclusions, public.github_sync_runs, public.github_integration_events from anon, authenticated;
revoke all on function public.get_own_github_integration_context() from public, anon;
revoke all on function public.get_public_talent_github_context(text) from public;
grant execute on function public.get_own_github_integration_context() to authenticated;
grant execute on function public.get_public_talent_github_context(text) to anon, authenticated;
