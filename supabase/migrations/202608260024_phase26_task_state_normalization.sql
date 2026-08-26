-- Phase 26 — Task state normalization
-- Owner: Workspaces module. Reason: normalize existing milestone tasks to the approved focused task state language after the base schema transaction commits.
-- Risk: invalid task-state transition or audit ambiguity.
-- Rollback: forward-only mapping to an allowed state; task and activity history remain intact.

alter type public.project_workspace_task_state add value if not exists 'backlog';
alter type public.project_workspace_task_state add value if not exists 'ready';
alter type public.project_workspace_task_state add value if not exists 'in_review';
alter type public.project_workspace_task_state add value if not exists 'done';
alter type public.project_workspace_task_state add value if not exists 'cancelled';
