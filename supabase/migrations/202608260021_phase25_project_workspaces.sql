-- Phase 25 — Project Workspace
-- Owner: Workspaces module. Reason: add a protected execution-context shell without creating messaging, file uploads, submissions, reviewer decisions, contracts, payments, code execution, or AI behavior.
-- Risk: cross-organization disclosure, removed-participant access, private-project leakage, invalid state changes, and untracked access changes.
-- Rollback: forward compensation only; disable workspace routes/RPC grants while retaining participant-restricted workspace, task, and audit history.

create type public.project_workspace_state as enum (
  'preparing', 'active', 'paused', 'awaiting_submission', 'under_review', 'completed', 'closed'
);
create type public.project_workspace_member_role as enum (
  'talent_participant', 'company_participant', 'reviewer'
);
create type public.project_workspace_member_status as enum ('active', 'removed');
create type public.project_workspace_task_state as enum (
  'not_started', 'in_progress', 'blocked', 'completed'
);

create table public.project_workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  accepted_application_id uuid references public.project_applications(id) on delete restrict,
  state public.project_workspace_state not null default 'preparing',
  visibility text not null default 'participants' check (visibility = 'participants'),
  deadline_timezone text not null default 'UTC' check (char_length(deadline_timezone) between 1 and 80),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (accepted_application_id)
);

create table public.project_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.project_workspace_member_role not null,
  status public.project_workspace_member_status not null default 'active',
  granted_by_user_id uuid not null references auth.users(id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, role),
  check ((status = 'removed') = (removed_at is not null))
);

create table public.project_workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  state public.project_workspace_task_state not null default 'not_started',
  assigned_user_id uuid references auth.users(id) on delete restrict,
  source_milestone_index integer check (source_milestone_index between 0 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_milestone_index)
);

create table public.project_workspace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete restrict,
  task_id uuid references public.project_workspace_tasks(id) on delete restrict,
  event_type text not null check (event_type in (
    'workspace.created', 'workspace.state_changed',
    'workspace.member_granted', 'workspace.member_removed', 'workspace.member_reactivated',
    'workspace.task_created', 'workspace.task_changed',
    'workspace.file_event', 'workspace.submission_event'
  )),
  previous_state public.project_workspace_state,
  next_state public.project_workspace_state,
  occurred_at timestamptz not null default now(),
  check ((event_type = 'workspace.state_changed') = (previous_state is not null and next_state is not null))
);

create index project_workspaces_project_updated_idx
  on public.project_workspaces(project_id, updated_at desc);
create index project_workspaces_organization_updated_idx
  on public.project_workspaces(organization_id, updated_at desc);
create index project_workspace_members_active_user_idx
  on public.project_workspace_members(user_id, workspace_id)
  where status = 'active';
create index project_workspace_tasks_workspace_updated_idx
  on public.project_workspace_tasks(workspace_id, updated_at asc);
create index project_workspace_activity_workspace_occurred_idx
  on public.project_workspace_activity(workspace_id, occurred_at desc);

alter table public.project_workspaces enable row level security;
alter table public.project_workspace_members enable row level security;
alter table public.project_workspace_tasks enable row level security;
alter table public.project_workspace_activity enable row level security;

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
      or (member.role = 'reviewer' and context.active_role = 'reviewer')
    )
  order by case member.role when 'talent_participant' then 1 else 2 end
  limit 1;
  return result;
end;
$$;

create or replace function public.has_project_workspace_access(requested_workspace_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select public.project_workspace_access_role(requested_workspace_id) is not null
$$;

create policy "authorized participants can view workspace shells"
  on public.project_workspaces for select to authenticated
  using (public.has_project_workspace_access(id));
create policy "authorized participants can view workspace members"
  on public.project_workspace_members for select to authenticated
  using (public.has_project_workspace_access(workspace_id));
create policy "authorized participants can view workspace tasks"
  on public.project_workspace_tasks for select to authenticated
  using (public.has_project_workspace_access(workspace_id));
create policy "authorized participants can view workspace activity"
  on public.project_workspace_activity for select to authenticated
  using (public.has_project_workspace_access(workspace_id));

create or replace function public.require_active_company_workspace_owner(requested_workspace_id uuid)
returns public.project_workspaces
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.project_workspaces;
begin
  select workspace.* into result
  from public.project_workspaces workspace
  join public.active_contexts context on context.user_id = actor_id
  where workspace.id = requested_workspace_id
    and context.active_role = 'company_member'
    and context.active_organization_id = workspace.organization_id
    and public.has_organization_permission(workspace.organization_id, 'owner');
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function public.create_project_workspace_from_accepted_application(
  requested_application_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  active_organization_id uuid := public.require_active_company_project_context(true);
  application_record public.project_applications;
  project_record public.company_project_drafts;
  workspace_record public.project_workspaces;
  task_record public.project_workspace_tasks;
  milestone jsonb;
  milestone_index integer := 0;
begin
  select application.* into application_record
  from public.project_applications application
  where application.id = requested_application_id
    and application.organization_id = active_organization_id
    and application.state = 'accepted'
  for update;
  if application_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;

  select project.* into project_record
  from public.company_project_drafts project
  where project.id = application_record.project_id
    and project.organization_id = active_organization_id
    and project.state = 'in_progress'
  for update;
  if project_record.id is null then raise exception 'INVALID_STATE'; end if;
  if exists (select 1 from public.project_workspaces workspace where workspace.accepted_application_id = application_record.id) then
    raise exception 'CONFLICT';
  end if;

  insert into public.project_workspaces (
    project_id, organization_id, accepted_application_id, created_by_user_id
  ) values (
    project_record.id, active_organization_id, application_record.id, actor_id
  ) returning * into workspace_record;

  insert into public.project_workspace_members (
    workspace_id, organization_id, user_id, role, granted_by_user_id
  ) values
    (workspace_record.id, active_organization_id, actor_id, 'company_participant', actor_id),
    (workspace_record.id, active_organization_id, application_record.talent_user_id, 'talent_participant', actor_id);

  insert into public.project_workspace_activity (
    workspace_id, organization_id, actor_user_id, event_type
  ) values (workspace_record.id, active_organization_id, actor_id, 'workspace.created');
  insert into public.project_workspace_activity (
    workspace_id, organization_id, actor_user_id, subject_user_id, event_type
  ) values
    (workspace_record.id, active_organization_id, actor_id, actor_id, 'workspace.member_granted'),
    (workspace_record.id, active_organization_id, actor_id, application_record.talent_user_id, 'workspace.member_granted');

  for milestone in select value from jsonb_array_elements(project_record.milestones) loop
    if char_length(trim(coalesce(milestone->>'name', ''))) > 0 then
      insert into public.project_workspace_tasks (
        workspace_id, organization_id, title, description, source_milestone_index
      ) values (
        workspace_record.id,
        active_organization_id,
        left(trim(milestone->>'name'), 160),
        left(trim(coalesce(milestone->>'description', '')), 1000),
        milestone_index
      ) returning * into task_record;
      insert into public.project_workspace_activity (
        workspace_id, organization_id, actor_user_id, task_id, event_type
      ) values (
        workspace_record.id, active_organization_id, actor_id, task_record.id, 'workspace.task_created'
      );
    end if;
    milestone_index := milestone_index + 1;
  end loop;

  return jsonb_build_object('id', workspace_record.id, 'state', workspace_record.state);
end;
$$;

create or replace function public.transition_project_workspace(
  requested_workspace_id uuid,
  requested_state public.project_workspace_state
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); result public.project_workspaces; previous public.project_workspace_state;
begin
  result := public.require_active_company_workspace_owner(requested_workspace_id);
  select * into result from public.project_workspaces where id = result.id for update;
  previous := result.state;
  if not (
    (previous = 'preparing' and requested_state in ('active', 'paused', 'closed'))
    or (previous = 'active' and requested_state in ('paused', 'awaiting_submission', 'closed'))
    or (previous = 'paused' and requested_state in ('active', 'closed'))
    or (previous = 'awaiting_submission' and requested_state in ('active', 'under_review', 'closed'))
    or (previous = 'under_review' and requested_state in ('active', 'completed', 'closed'))
    or (previous = 'completed' and requested_state = 'closed')
  ) then raise exception 'INVALID_STATE'; end if;

  update public.project_workspaces set state = requested_state, updated_at = now()
  where id = result.id returning * into result;
  insert into public.project_workspace_activity (
    workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state
  ) values (
    result.id, result.organization_id, actor_id, 'workspace.state_changed', previous, requested_state
  );
  return jsonb_build_object('id', result.id, 'state', result.state);
end;
$$;

create or replace function public.set_project_workspace_member_status(
  requested_workspace_id uuid,
  requested_user_id uuid,
  requested_role public.project_workspace_member_role,
  requested_status public.project_workspace_member_status
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); workspace_record public.project_workspaces; member_record public.project_workspace_members;
begin
  workspace_record := public.require_active_company_workspace_owner(requested_workspace_id);
  select * into member_record
  from public.project_workspace_members member
  where member.workspace_id = workspace_record.id
    and member.user_id = requested_user_id
    and member.role = requested_role
  for update;
  if member_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if member_record.status = requested_status then
    return jsonb_build_object('id', member_record.id, 'status', member_record.status);
  end if;
  if requested_status = 'removed' and member_record.role = 'company_participant' and not exists (
    select 1 from public.project_workspace_members member
    where member.workspace_id = workspace_record.id
      and member.role = 'company_participant'
      and member.status = 'active'
      and member.id <> member_record.id
  ) then raise exception 'INVALID_STATE'; end if;

  update public.project_workspace_members set
    status = requested_status,
    removed_at = case when requested_status = 'removed' then now() else null end,
    updated_at = now()
  where id = member_record.id
  returning * into member_record;
  insert into public.project_workspace_activity (
    workspace_id, organization_id, actor_user_id, subject_user_id, event_type
  ) values (
    workspace_record.id,
    workspace_record.organization_id,
    actor_id,
    member_record.user_id,
    case when requested_status = 'removed' then 'workspace.member_removed' else 'workspace.member_reactivated' end
  );
  return jsonb_build_object('id', member_record.id, 'status', member_record.status);
end;
$$;

create or replace function public.get_project_workspace(requested_workspace_id uuid)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); access_role public.project_workspace_member_role; workspace_record public.project_workspaces; project_record public.company_project_drafts; result jsonb;
begin
  access_role := public.project_workspace_access_role(requested_workspace_id);
  if access_role is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into workspace_record from public.project_workspaces where id = requested_workspace_id;
  select * into project_record from public.company_project_drafts where id = workspace_record.project_id;
  if workspace_record.id is null or project_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;

  select jsonb_build_object(
    'id', workspace_record.id,
    'state', workspace_record.state,
    'access_role', access_role,
    'deadline_timezone', workspace_record.deadline_timezone,
    'created_at', workspace_record.created_at,
    'updated_at', workspace_record.updated_at,
    'project', case when access_role = 'reviewer' then jsonb_build_object(
      'title', project_record.title,
      'one_sentence_goal', project_record.one_sentence_goal,
      'required_output', project_record.required_output,
      'acceptance_criteria', project_record.acceptance_criteria,
      'submission_format', project_record.submission_format,
      'revision_policy', project_record.revision_policy,
      'review_method', project_record.review_method,
      'reviewer_expectations', project_record.reviewer_expectations
    ) else jsonb_build_object(
      'public_id', project_record.public_id,
      'title', project_record.title,
      'one_sentence_goal', project_record.one_sentence_goal,
      'context_and_problem', project_record.context_and_problem,
      'why_it_matters', project_record.why_it_matters,
      'expected_role', project_record.expected_role,
      'required_output', project_record.required_output,
      'acceptance_criteria', project_record.acceptance_criteria,
      'submission_format', project_record.submission_format,
      'timebox_hours', project_record.timebox_hours,
      'milestones', project_record.milestones,
      'out_of_scope', project_record.out_of_scope,
      'evaluation_dimensions', project_record.evaluation_dimensions,
      'review_method', project_record.review_method,
      'reviewer_expectations', project_record.reviewer_expectations,
      'revision_policy', project_record.revision_policy,
      'decision_timeline', project_record.decision_timeline,
      'application_deadline', project_record.application_deadline,
      'participant_expectations', project_record.participant_expectations,
      'data_access_restrictions', project_record.data_access_restrictions,
      'ownership_terms', project_record.ownership_terms
    ) end,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', member.role,
        'status', member.status,
        'is_current_actor', member.user_id = actor_id
      ) order by member.role, member.created_at)
      from public.project_workspace_members member
      where member.workspace_id = workspace_record.id
    ), '[]'::jsonb),
    'tasks', case
      when access_role = 'reviewer' then '[]'::jsonb
      when access_role = 'company_participant' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', task.id, 'title', task.title, 'description', task.description,
          'state', task.state, 'is_assigned_to_current_actor', task.assigned_user_id = actor_id
        ) order by task.created_at asc)
        from public.project_workspace_tasks task where task.workspace_id = workspace_record.id
      ), '[]'::jsonb)
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', task.id, 'title', task.title, 'description', task.description,
          'state', task.state, 'is_assigned_to_current_actor', true
        ) order by task.created_at asc)
        from public.project_workspace_tasks task
        where task.workspace_id = workspace_record.id and task.assigned_user_id = actor_id
      ), '[]'::jsonb)
    end,
    'review_context', jsonb_build_object(
      'evaluation_dimensions', project_record.evaluation_dimensions,
      'submission_format', project_record.submission_format,
      'revision_policy', project_record.revision_policy,
      'review_method', project_record.review_method,
      'reviewer_expectations', project_record.reviewer_expectations,
      'review_state', case when workspace_record.state = 'under_review' then 'review material is not assigned in this workspace shell' else 'not available' end
    ),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', activity.event_type,
        'previous_state', activity.previous_state,
        'next_state', activity.next_state,
        'occurred_at', activity.occurred_at
      ) order by activity.occurred_at desc)
      from (
        select * from public.project_workspace_activity
        where workspace_id = workspace_record.id
        order by occurred_at desc limit 50
      ) activity
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'can_change_state', access_role = 'company_participant' and public.has_organization_permission(workspace_record.organization_id, 'owner'),
      'can_manage_tasks', false,
      'can_upload_files', false,
      'can_create_submission', false,
      'review_material_assigned', access_role = 'reviewer'
    )
  ) into result;
  return result;
end;
$$;

revoke all on table public.project_workspaces, public.project_workspace_members, public.project_workspace_tasks, public.project_workspace_activity from anon, authenticated;
revoke all on function public.project_workspace_access_role(uuid), public.has_project_workspace_access(uuid), public.require_active_company_workspace_owner(uuid), public.create_project_workspace_from_accepted_application(uuid), public.transition_project_workspace(uuid, public.project_workspace_state), public.set_project_workspace_member_status(uuid, uuid, public.project_workspace_member_role, public.project_workspace_member_status), public.get_project_workspace(uuid) from public, anon;
grant execute on function public.project_workspace_access_role(uuid), public.has_project_workspace_access(uuid), public.create_project_workspace_from_accepted_application(uuid), public.transition_project_workspace(uuid, public.project_workspace_state), public.set_project_workspace_member_status(uuid, uuid, public.project_workspace_member_role, public.project_workspace_member_status), public.get_project_workspace(uuid) to authenticated;
