-- Phase 26 — Tasks, Files, and Submissions
-- Owner: Workspaces/Evidence modules. Reason: add bounded execution artifacts and versioned submission packages for later human review.
-- Risk: cross-workspace artifact disclosure, malicious/oversized upload, silent replacement, invalid state transitions, and reviewer overexposure.
-- Rollback: forward compensation only; revoke RPCs and private storage policies while preserving participant-restricted task, file, version, submission, and audit history.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proofly-private', 'proofly-private', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.project_workspace_tasks
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  add column if not exists due_date date,
  add column if not exists acceptance_criteria text not null default '' check (char_length(acceptance_criteria) <= 1200),
  add column if not exists dependency_task_ids uuid[] not null default '{}'::uuid[] check (cardinality(dependency_task_ids) <= 10),
  add column if not exists created_by_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists updated_by_user_id uuid references auth.users(id) on delete restrict;

update public.project_workspace_tasks task
set created_by_user_id = workspace.created_by_user_id,
    updated_by_user_id = workspace.created_by_user_id
from public.project_workspaces workspace
where task.workspace_id = workspace.id
  and (task.created_by_user_id is null or task.updated_by_user_id is null);

alter table public.project_workspace_tasks
  alter column created_by_user_id set not null,
  alter column updated_by_user_id set not null;

create table public.project_workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  task_id uuid references public.project_workspace_tasks(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 180),
  description text not null default '' check (char_length(description) <= 600),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_workspace_file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.project_workspace_files(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  uploaded_by_user_id uuid not null references auth.users(id) on delete restrict,
  version_number integer not null check (version_number between 1 and 999),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_bucket text not null default 'proofly-private' check (storage_bucket = 'proofly-private'),
  object_key text not null unique check (
    char_length(object_key) between 1 and 400 and object_key not like '/%' and object_key not like '%..%' and object_key not like '%\\%'
  ),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  scan_state text not null default 'pending' check (scan_state in ('pending', 'clean', 'rejected')),
  access_scope text not null default 'participants' check (access_scope in ('participants', 'review_material')),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  rejected_at timestamptz,
  unique (file_id, version_number),
  check ((scan_state = 'clean') = (validated_at is not null)),
  check ((scan_state = 'rejected') = (rejected_at is not null))
);

create type public.project_workspace_submission_state as enum (
  'draft', 'submitted', 'under_review', 'changes_requested', 'resubmitted', 'accepted', 'rejected'
);

create table public.project_workspace_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  task_id uuid references public.project_workspace_tasks(id) on delete restrict,
  state public.project_workspace_submission_state not null default 'draft',
  current_version_number integer not null default 1 check (current_version_number between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, talent_user_id)
);

create table public.project_workspace_submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.project_workspace_submissions(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version_number integer not null check (version_number between 1 and 999),
  summary text not null default '' check (char_length(summary) <= 1000),
  problem_interpretation text not null default '' check (char_length(problem_interpretation) <= 1400),
  approach_and_decisions text not null default '' check (char_length(approach_and_decisions) <= 1800),
  deliverables text not null default '' check (char_length(deliverables) <= 1400),
  demo_or_repository_link text check (demo_or_repository_link is null or demo_or_repository_link ~ '^https://[^[:space:]]+$'),
  known_limitations text not null default '' check (char_length(known_limitations) <= 1400),
  completion_context text not null default '' check (char_length(completion_context) <= 700),
  ownership_confirmed boolean not null default false,
  attribution_confirmed boolean not null default false,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

create table public.project_workspace_submission_version_files (
  submission_version_id uuid not null references public.project_workspace_submission_versions(id) on delete restrict,
  file_version_id uuid not null references public.project_workspace_file_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (submission_version_id, file_version_id)
);

create table public.project_workspace_submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.project_workspace_submissions(id) on delete restrict,
  submission_version_id uuid references public.project_workspace_submission_versions(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('draft_saved', 'revision_created', 'submitted', 'resubmitted')),
  previous_state public.project_workspace_submission_state,
  next_state public.project_workspace_submission_state,
  idempotency_key uuid,
  occurred_at timestamptz not null default now(),
  unique (submission_id, idempotency_key)
);

create index project_workspace_files_workspace_updated_idx on public.project_workspace_files(workspace_id, updated_at desc);
create index project_workspace_file_versions_workspace_created_idx on public.project_workspace_file_versions(workspace_id, created_at desc);
create index project_workspace_submissions_workspace_updated_idx on public.project_workspace_submissions(workspace_id, updated_at desc);
create index project_workspace_submission_versions_submission_idx on public.project_workspace_submission_versions(submission_id, version_number desc);

alter table public.project_workspace_files enable row level security;
alter table public.project_workspace_file_versions enable row level security;
alter table public.project_workspace_submissions enable row level security;
alter table public.project_workspace_submission_versions enable row level security;
alter table public.project_workspace_submission_version_files enable row level security;
alter table public.project_workspace_submission_events enable row level security;

create policy "participants can view workspace file records" on public.project_workspace_files for select to authenticated using (public.has_project_workspace_access(workspace_id));
create policy "participants can view workspace file versions" on public.project_workspace_file_versions for select to authenticated using (public.has_project_workspace_access(workspace_id));
create policy "participants can view workspace submissions" on public.project_workspace_submissions for select to authenticated using (public.has_project_workspace_access(workspace_id));
create policy "participants can view workspace submission versions" on public.project_workspace_submission_versions for select to authenticated using (public.has_project_workspace_access(workspace_id));
create policy "participants can view submission file links" on public.project_workspace_submission_version_files for select to authenticated using (
  exists (select 1 from public.project_workspace_submission_versions version where version.id = submission_version_id and public.has_project_workspace_access(version.workspace_id))
);
create policy "participants can view submission events" on public.project_workspace_submission_events for select to authenticated using (public.has_project_workspace_access(workspace_id));

create or replace function public.workspace_task_transition_allowed(
  current_state public.project_workspace_task_state,
  requested_state public.project_workspace_task_state
) returns boolean language sql immutable as $$
  select (current_state = 'not_started' and requested_state in ('in_progress', 'blocked'))
      or (current_state = 'in_progress' and requested_state in ('not_started', 'blocked', 'completed'))
      or (current_state = 'blocked' and requested_state in ('not_started', 'in_progress'))
      or (current_state = 'completed' and requested_state = 'in_progress')
$$;

create or replace function public.create_project_workspace_task(
  requested_workspace_id uuid, requested_title text, requested_description text,
  requested_priority text, requested_due_date date, requested_acceptance_criteria text,
  requested_dependency_task_ids uuid[] default '{}'::uuid[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); workspace_record public.project_workspaces; task_record public.project_workspace_tasks;
begin
  workspace_record := public.require_active_company_workspace_owner(requested_workspace_id);
  if workspace_record.state not in ('preparing', 'active', 'awaiting_submission') then raise exception 'INVALID_STATE'; end if;
  if char_length(trim(requested_title)) not between 1 and 160 or char_length(coalesce(requested_description, '')) > 1000 or char_length(coalesce(requested_acceptance_criteria, '')) > 1200 or requested_priority not in ('low', 'normal', 'high') or cardinality(coalesce(requested_dependency_task_ids, '{}'::uuid[])) > 10 then raise exception 'VALIDATION_FAILED'; end if;
  if exists (select 1 from unnest(coalesce(requested_dependency_task_ids, '{}'::uuid[])) dependency_id where not exists (select 1 from public.project_workspace_tasks task where task.id = dependency_id and task.workspace_id = workspace_record.id)) then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.project_workspace_tasks (workspace_id, organization_id, title, description, priority, due_date, acceptance_criteria, dependency_task_ids, created_by_user_id, updated_by_user_id)
  values (workspace_record.id, workspace_record.organization_id, trim(requested_title), coalesce(requested_description, ''), requested_priority, requested_due_date, coalesce(requested_acceptance_criteria, ''), coalesce(requested_dependency_task_ids, '{}'::uuid[]), actor_id, actor_id) returning * into task_record;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (workspace_record.id, workspace_record.organization_id, actor_id, task_record.id, 'workspace.task_created');
  return jsonb_build_object('id', task_record.id, 'state', task_record.state);
end;
$$;

create or replace function public.update_project_workspace_task(
  requested_task_id uuid, requested_title text, requested_description text, requested_priority text,
  requested_due_date date, requested_acceptance_criteria text, requested_assigned_user_id uuid,
  requested_dependency_task_ids uuid[] default '{}'::uuid[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); task_record public.project_workspace_tasks; workspace_record public.project_workspaces;
begin
  select * into task_record from public.project_workspace_tasks where id = requested_task_id for update;
  if task_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  workspace_record := public.require_active_company_workspace_owner(task_record.workspace_id);
  if workspace_record.state not in ('preparing', 'active', 'awaiting_submission') then raise exception 'INVALID_STATE'; end if;
  if char_length(trim(requested_title)) not between 1 and 160 or char_length(coalesce(requested_description, '')) > 1000 or char_length(coalesce(requested_acceptance_criteria, '')) > 1200 or requested_priority not in ('low', 'normal', 'high') or cardinality(coalesce(requested_dependency_task_ids, '{}'::uuid[])) > 10 then raise exception 'VALIDATION_FAILED'; end if;
  if requested_assigned_user_id is not null and not exists (select 1 from public.project_workspace_members member where member.workspace_id = workspace_record.id and member.user_id = requested_assigned_user_id and member.status = 'active' and member.role = 'talent_participant') then raise exception 'VALIDATION_FAILED'; end if;
  if exists (select 1 from unnest(coalesce(requested_dependency_task_ids, '{}'::uuid[])) dependency_id where dependency_id = task_record.id or not exists (select 1 from public.project_workspace_tasks task where task.id = dependency_id and task.workspace_id = workspace_record.id)) then raise exception 'VALIDATION_FAILED'; end if;
  update public.project_workspace_tasks set title = trim(requested_title), description = coalesce(requested_description, ''), priority = requested_priority, due_date = requested_due_date, acceptance_criteria = coalesce(requested_acceptance_criteria, ''), assigned_user_id = requested_assigned_user_id, dependency_task_ids = coalesce(requested_dependency_task_ids, '{}'::uuid[]), updated_by_user_id = actor_id, updated_at = now() where id = task_record.id returning * into task_record;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (workspace_record.id, workspace_record.organization_id, actor_id, task_record.id, 'workspace.task_changed');
  return jsonb_build_object('id', task_record.id, 'state', task_record.state);
end;
$$;

create or replace function public.transition_project_workspace_task(
  requested_task_id uuid, requested_state public.project_workspace_task_state
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); task_record public.project_workspace_tasks; workspace_record public.project_workspaces; role public.project_workspace_member_role;
begin
  select * into task_record from public.project_workspace_tasks where id = requested_task_id for update;
  if task_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into workspace_record from public.project_workspaces where id = task_record.workspace_id;
  role := public.project_workspace_access_role(task_record.workspace_id);
  if role is null or workspace_record.state not in ('active', 'awaiting_submission') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if role = 'reviewer' or (role = 'talent_participant' and task_record.assigned_user_id is distinct from actor_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if task_record.state = requested_state then return jsonb_build_object('id', task_record.id, 'state', task_record.state); end if;
  if not public.workspace_task_transition_allowed(task_record.state, requested_state) then raise exception 'INVALID_STATE'; end if;
  update public.project_workspace_tasks set state = requested_state, updated_by_user_id = actor_id, updated_at = now() where id = task_record.id returning * into task_record;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (workspace_record.id, workspace_record.organization_id, actor_id, task_record.id, 'workspace.task_changed');
  return jsonb_build_object('id', task_record.id, 'state', task_record.state);
end;
$$;

create or replace function public.prepare_project_workspace_file_upload(
  requested_workspace_id uuid, requested_file_id uuid, requested_task_id uuid, requested_display_name text,
  requested_description text, requested_original_filename text, requested_content_type text,
  requested_size_bytes bigint, requested_sha256 text, requested_object_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); role public.project_workspace_member_role; workspace_record public.project_workspaces; file_record public.project_workspace_files; version_record public.project_workspace_file_versions; next_version integer;
begin
  role := public.project_workspace_access_role(requested_workspace_id);
  select * into workspace_record from public.project_workspaces where id = requested_workspace_id;
  if role not in ('talent_participant', 'company_participant') or workspace_record.id is null or workspace_record.state not in ('active', 'awaiting_submission') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if char_length(trim(requested_display_name)) not between 1 and 180 or char_length(coalesce(requested_description, '')) > 600 or char_length(trim(requested_original_filename)) not between 1 and 255 or requested_content_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain') or requested_size_bytes not between 1 and 10485760 or requested_sha256 !~ '^[a-f0-9]{64}$' or requested_object_key !~ ('^' || actor_id::text || '/[A-Za-z0-9._/-]+$') or requested_object_key like '%..%' or requested_object_key like '%\\%' then raise exception 'VALIDATION_FAILED'; end if;
  if requested_task_id is not null and not exists (select 1 from public.project_workspace_tasks task where task.id = requested_task_id and task.workspace_id = workspace_record.id) then raise exception 'VALIDATION_FAILED'; end if;
  if requested_file_id is null then
    insert into public.project_workspace_files (workspace_id, organization_id, task_id, owner_user_id, display_name, description)
    values (workspace_record.id, workspace_record.organization_id, requested_task_id, actor_id, trim(requested_display_name), coalesce(requested_description, '')) returning * into file_record;
    next_version := 1;
  else
    select * into file_record from public.project_workspace_files where id = requested_file_id and workspace_id = workspace_record.id for update;
    if file_record.id is null or file_record.owner_user_id <> actor_id or file_record.lifecycle_state <> 'active' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    select coalesce(max(version_number), 0) + 1 into next_version from public.project_workspace_file_versions where file_id = file_record.id;
    update public.project_workspace_files set task_id = requested_task_id, display_name = trim(requested_display_name), description = coalesce(requested_description, ''), updated_at = now() where id = file_record.id returning * into file_record;
  end if;
  insert into public.project_workspace_file_versions (file_id, workspace_id, organization_id, uploaded_by_user_id, version_number, original_filename, object_key, content_type, size_bytes, sha256)
  values (file_record.id, workspace_record.id, workspace_record.organization_id, actor_id, next_version, trim(requested_original_filename), requested_object_key, requested_content_type, requested_size_bytes, requested_sha256) returning * into version_record;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (workspace_record.id, workspace_record.organization_id, actor_id, file_record.task_id, 'workspace.file_event');
  return jsonb_build_object('file_id', file_record.id, 'file_version_id', version_record.id, 'object_key', version_record.object_key);
end;
$$;

create or replace function public.complete_project_workspace_file_upload(requested_file_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); version_record public.project_workspace_file_versions;
begin
  select * into version_record from public.project_workspace_file_versions where id = requested_file_version_id for update;
  if version_record.id is null or version_record.uploaded_by_user_id <> actor_id or version_record.scan_state <> 'pending' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.project_workspace_file_versions set scan_state = 'clean', validated_at = now() where id = version_record.id returning * into version_record;
  return jsonb_build_object('id', version_record.id, 'scan_state', version_record.scan_state);
end;
$$;

create or replace function public.reject_project_workspace_file_upload(requested_file_version_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); version_record public.project_workspace_file_versions;
begin
  select * into version_record from public.project_workspace_file_versions where id = requested_file_version_id for update;
  if version_record.id is null or version_record.uploaded_by_user_id <> actor_id or version_record.scan_state <> 'pending' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.project_workspace_file_versions set scan_state = 'rejected', rejected_at = now() where id = version_record.id;
end;
$$;

create or replace function public.can_insert_project_workspace_storage_object(requested_object_key text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.project_workspace_file_versions version where version.storage_bucket = 'proofly-private' and version.object_key = requested_object_key and version.uploaded_by_user_id = auth.uid() and version.scan_state = 'pending')
$$;

create or replace function public.can_read_project_workspace_storage_object(requested_object_key text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare version_record public.project_workspace_file_versions; access_role public.project_workspace_member_role;
begin
  select * into version_record from public.project_workspace_file_versions where storage_bucket = 'proofly-private' and object_key = requested_object_key and scan_state = 'clean';
  if version_record.id is null then return false; end if;
  access_role := public.project_workspace_access_role(version_record.workspace_id);
  return access_role in ('talent_participant', 'company_participant') or (access_role = 'reviewer' and version_record.access_scope = 'review_material');
end;
$$;

create policy "workspace file objects are private on insert" on storage.objects for insert to authenticated with check (bucket_id = 'proofly-private' and public.can_insert_project_workspace_storage_object(name));
create policy "workspace file objects are private on read" on storage.objects for select to authenticated using (bucket_id = 'proofly-private' and public.can_read_project_workspace_storage_object(name));

create or replace function public.save_project_workspace_submission_draft(
  requested_workspace_id uuid, requested_task_id uuid, requested_summary text, requested_problem_interpretation text,
  requested_approach_and_decisions text, requested_deliverables text, requested_demo_or_repository_link text,
  requested_known_limitations text, requested_completion_context text, requested_ownership_confirmed boolean,
  requested_attribution_confirmed boolean, requested_file_version_ids uuid[] default '{}'::uuid[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); workspace_record public.project_workspaces; submission_record public.project_workspace_submissions; version_record public.project_workspace_submission_versions; next_version integer;
begin
  if public.project_workspace_access_role(requested_workspace_id) <> 'talent_participant' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into workspace_record from public.project_workspaces where id = requested_workspace_id;
  if workspace_record.id is null or workspace_record.state not in ('active', 'awaiting_submission') then raise exception 'INVALID_STATE'; end if;
  if char_length(coalesce(requested_summary, '')) > 1000 or char_length(coalesce(requested_problem_interpretation, '')) > 1400 or char_length(coalesce(requested_approach_and_decisions, '')) > 1800 or char_length(coalesce(requested_deliverables, '')) > 1400 or char_length(coalesce(requested_known_limitations, '')) > 1400 or char_length(coalesce(requested_completion_context, '')) > 700 or (requested_demo_or_repository_link is not null and requested_demo_or_repository_link <> '' and requested_demo_or_repository_link !~ '^https://[^[:space:]]+$') or cardinality(coalesce(requested_file_version_ids, '{}'::uuid[])) > 8 or cardinality(coalesce(requested_file_version_ids, '{}'::uuid[])) <> cardinality(array(select distinct value from unnest(coalesce(requested_file_version_ids, '{}'::uuid[])) value)) then raise exception 'VALIDATION_FAILED'; end if;
  if requested_task_id is not null and not exists (select 1 from public.project_workspace_tasks task where task.id = requested_task_id and task.workspace_id = workspace_record.id and task.assigned_user_id = actor_id) then raise exception 'VALIDATION_FAILED'; end if;
  if exists (select 1 from unnest(coalesce(requested_file_version_ids, '{}'::uuid[])) file_version_id where not exists (select 1 from public.project_workspace_file_versions version join public.project_workspace_files file on file.id = version.file_id where version.id = file_version_id and version.workspace_id = workspace_record.id and version.scan_state = 'clean' and file.owner_user_id = actor_id and file.lifecycle_state = 'active')) then raise exception 'VALIDATION_FAILED'; end if;
  select * into submission_record from public.project_workspace_submissions where workspace_id = workspace_record.id and talent_user_id = actor_id for update;
  if submission_record.id is null then
    insert into public.project_workspace_submissions (workspace_id, organization_id, talent_user_id, task_id) values (workspace_record.id, workspace_record.organization_id, actor_id, requested_task_id) returning * into submission_record;
    insert into public.project_workspace_submission_versions (submission_id, workspace_id, organization_id, version_number, summary, problem_interpretation, approach_and_decisions, deliverables, demo_or_repository_link, known_limitations, completion_context, ownership_confirmed, attribution_confirmed, created_by_user_id)
    values (submission_record.id, workspace_record.id, workspace_record.organization_id, 1, coalesce(requested_summary, ''), coalesce(requested_problem_interpretation, ''), coalesce(requested_approach_and_decisions, ''), coalesce(requested_deliverables, ''), nullif(requested_demo_or_repository_link, ''), coalesce(requested_known_limitations, ''), coalesce(requested_completion_context, ''), requested_ownership_confirmed, requested_attribution_confirmed, actor_id) returning * into version_record;
  elsif submission_record.state = 'draft' then
    select * into version_record from public.project_workspace_submission_versions where submission_id = submission_record.id and version_number = submission_record.current_version_number for update;
    update public.project_workspace_submission_versions set summary = coalesce(requested_summary, ''), problem_interpretation = coalesce(requested_problem_interpretation, ''), approach_and_decisions = coalesce(requested_approach_and_decisions, ''), deliverables = coalesce(requested_deliverables, ''), demo_or_repository_link = nullif(requested_demo_or_repository_link, ''), known_limitations = coalesce(requested_known_limitations, ''), completion_context = coalesce(requested_completion_context, ''), ownership_confirmed = requested_ownership_confirmed, attribution_confirmed = requested_attribution_confirmed, updated_at = now() where id = version_record.id returning * into version_record;
  elsif submission_record.state = 'changes_requested' then
    next_version := submission_record.current_version_number + 1;
    update public.project_workspace_submissions set current_version_number = next_version, task_id = requested_task_id, updated_at = now() where id = submission_record.id returning * into submission_record;
    insert into public.project_workspace_submission_versions (submission_id, workspace_id, organization_id, version_number, summary, problem_interpretation, approach_and_decisions, deliverables, demo_or_repository_link, known_limitations, completion_context, ownership_confirmed, attribution_confirmed, created_by_user_id)
    values (submission_record.id, workspace_record.id, workspace_record.organization_id, next_version, coalesce(requested_summary, ''), coalesce(requested_problem_interpretation, ''), coalesce(requested_approach_and_decisions, ''), coalesce(requested_deliverables, ''), nullif(requested_demo_or_repository_link, ''), coalesce(requested_known_limitations, ''), coalesce(requested_completion_context, ''), requested_ownership_confirmed, requested_attribution_confirmed, actor_id) returning * into version_record;
    insert into public.project_workspace_submission_events (submission_id, submission_version_id, workspace_id, organization_id, actor_user_id, event_type) values (submission_record.id, version_record.id, workspace_record.id, workspace_record.organization_id, actor_id, 'revision_created');
  else raise exception 'INVALID_STATE'; end if;
  delete from public.project_workspace_submission_version_files where submission_version_id = version_record.id;
  insert into public.project_workspace_submission_version_files (submission_version_id, file_version_id) select version_record.id, file_version_id from unnest(coalesce(requested_file_version_ids, '{}'::uuid[])) file_version_id;
  insert into public.project_workspace_submission_events (submission_id, submission_version_id, workspace_id, organization_id, actor_user_id, event_type) values (submission_record.id, version_record.id, workspace_record.id, workspace_record.organization_id, actor_id, 'draft_saved');
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (workspace_record.id, workspace_record.organization_id, actor_id, requested_task_id, 'workspace.submission_event');
  return jsonb_build_object('submission_id', submission_record.id, 'version_id', version_record.id, 'state', submission_record.state, 'version_number', version_record.version_number);
end;
$$;

create or replace function public.submit_project_workspace_submission(requested_submission_id uuid, requested_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); submission_record public.project_workspace_submissions; version_record public.project_workspace_submission_versions; next_state public.project_workspace_submission_state;
begin
  select * into submission_record from public.project_workspace_submissions where id = requested_submission_id for update;
  if submission_record.id is null or submission_record.talent_user_id <> actor_id or public.project_workspace_access_role(submission_record.workspace_id) <> 'talent_participant' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if exists (select 1 from public.project_workspace_submission_events event where event.submission_id = submission_record.id and event.idempotency_key = requested_idempotency_key) then return jsonb_build_object('submission_id', submission_record.id, 'state', submission_record.state, 'idempotent', true); end if;
  if submission_record.state not in ('draft', 'changes_requested') then raise exception 'INVALID_STATE'; end if;
  select * into version_record from public.project_workspace_submission_versions where submission_id = submission_record.id and version_number = submission_record.current_version_number for update;
  if version_record.id is null or char_length(trim(version_record.summary)) = 0 or char_length(trim(version_record.problem_interpretation)) = 0 or char_length(trim(version_record.approach_and_decisions)) = 0 or char_length(trim(version_record.deliverables)) = 0 or char_length(trim(version_record.completion_context)) = 0 or not version_record.ownership_confirmed or not version_record.attribution_confirmed or not exists (select 1 from public.project_workspace_submission_version_files link join public.project_workspace_file_versions file_version on file_version.id = link.file_version_id where link.submission_version_id = version_record.id and file_version.scan_state = 'clean') then raise exception 'VALIDATION_FAILED'; end if;
  next_state := case when submission_record.state = 'draft' then 'submitted'::public.project_workspace_submission_state else 'resubmitted'::public.project_workspace_submission_state end;
  update public.project_workspace_submissions set state = next_state, updated_at = now() where id = submission_record.id returning * into submission_record;
  update public.project_workspace_file_versions set access_scope = 'review_material' where id in (select file_version_id from public.project_workspace_submission_version_files where submission_version_id = version_record.id);
  insert into public.project_workspace_submission_events (submission_id, submission_version_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key) values (submission_record.id, version_record.id, submission_record.workspace_id, submission_record.organization_id, actor_id, case when next_state = 'submitted' then 'submitted' else 'resubmitted' end, case when next_state = 'submitted' then 'draft'::public.project_workspace_submission_state else 'changes_requested'::public.project_workspace_submission_state end, next_state, requested_idempotency_key);
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, event_type) values (submission_record.workspace_id, submission_record.organization_id, actor_id, submission_record.task_id, 'workspace.submission_event');
  return jsonb_build_object('submission_id', submission_record.id, 'state', submission_record.state, 'version_id', version_record.id, 'version_number', version_record.version_number);
end;
$$;

revoke all on table public.project_workspace_files, public.project_workspace_file_versions, public.project_workspace_submissions, public.project_workspace_submission_versions, public.project_workspace_submission_version_files, public.project_workspace_submission_events from anon, authenticated;
revoke all on function public.create_project_workspace_task(uuid, text, text, text, date, text, uuid[]), public.update_project_workspace_task(uuid, text, text, text, date, text, uuid, uuid[]), public.transition_project_workspace_task(uuid, public.project_workspace_task_state), public.prepare_project_workspace_file_upload(uuid, uuid, uuid, text, text, text, text, bigint, text, text), public.complete_project_workspace_file_upload(uuid), public.reject_project_workspace_file_upload(uuid), public.can_insert_project_workspace_storage_object(text), public.can_read_project_workspace_storage_object(text), public.save_project_workspace_submission_draft(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean, uuid[]), public.submit_project_workspace_submission(uuid, uuid) from public, anon;
grant execute on function public.create_project_workspace_task(uuid, text, text, text, date, text, uuid[]), public.update_project_workspace_task(uuid, text, text, text, date, text, uuid, uuid[]), public.transition_project_workspace_task(uuid, public.project_workspace_task_state), public.prepare_project_workspace_file_upload(uuid, uuid, uuid, text, text, text, text, bigint, text, text), public.complete_project_workspace_file_upload(uuid), public.reject_project_workspace_file_upload(uuid), public.save_project_workspace_submission_draft(uuid, uuid, text, text, text, text, text, text, text, boolean, boolean, uuid[]), public.submit_project_workspace_submission(uuid, uuid) to authenticated;
