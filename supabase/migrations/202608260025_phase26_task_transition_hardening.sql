-- Phase 26 — Task transition hardening
-- Owner: Workspaces module. Reason: map legacy workspace task states into the approved limited workflow after enum values exist.
-- Risk: invalid state transition or historical task ambiguity.
-- Rollback: forward-only compensating state update; activity history remains append-only.

update public.project_workspace_tasks set state = 'backlog' where state = 'not_started';
update public.project_workspace_tasks set state = 'done' where state = 'completed';

create or replace function public.workspace_task_transition_allowed(
  current_state public.project_workspace_task_state,
  requested_state public.project_workspace_task_state
) returns boolean language sql immutable as $$
  select (current_state = 'backlog' and requested_state in ('ready', 'cancelled'))
      or (current_state = 'ready' and requested_state in ('backlog', 'in_progress', 'blocked', 'cancelled'))
      or (current_state = 'in_progress' and requested_state in ('ready', 'blocked', 'in_review', 'done'))
      or (current_state = 'blocked' and requested_state in ('ready', 'in_progress', 'cancelled'))
      or (current_state = 'in_review' and requested_state in ('in_progress', 'blocked', 'done'))
      or (current_state = 'done' and requested_state = 'in_progress')
      or (current_state = 'cancelled' and requested_state = 'backlog')
$$;
