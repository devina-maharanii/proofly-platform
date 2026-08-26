-- Phase 26 — Task assignment hardening
-- Owner: Workspaces module. Reason: provide one bounded, server-derived assignment path to the accepted active Talent participant.
-- Risk: client-selected participant assignment, cross-workspace identity disclosure, or unauthorized task reassignment.
-- Rollback: revoke assignment command; task/audit history remains participant-restricted.

create or replace function public.assign_project_workspace_task_to_active_talent(requested_task_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); task_record public.project_workspace_tasks; workspace_record public.project_workspaces; talent_user_id uuid;
begin
  select * into task_record from public.project_workspace_tasks where id = requested_task_id for update;
  if task_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  workspace_record := public.require_active_company_workspace_owner(task_record.workspace_id);
  if workspace_record.state not in ('preparing', 'active', 'awaiting_submission') then raise exception 'INVALID_STATE'; end if;
  select member.user_id into talent_user_id from public.project_workspace_members member
  where member.workspace_id = workspace_record.id and member.role = 'talent_participant' and member.status = 'active'
  order by member.created_at asc limit 1;
  if talent_user_id is null then raise exception 'INVALID_STATE'; end if;
  update public.project_workspace_tasks set assigned_user_id = talent_user_id, updated_by_user_id = actor_id, updated_at = now() where id = task_record.id returning * into task_record;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, task_id, subject_user_id, event_type)
  values (workspace_record.id, workspace_record.organization_id, actor_id, task_record.id, talent_user_id, 'workspace.task_changed');
  return jsonb_build_object('id', task_record.id, 'state', task_record.state);
end;
$$;

revoke all on function public.assign_project_workspace_task_to_active_talent(uuid) from public, anon;
grant execute on function public.assign_project_workspace_task_to_active_talent(uuid) to authenticated;
