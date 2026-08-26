-- Phase 26 — Workspace capability reader
-- Owner: Workspaces module. Reason: expose only server-derived UI capability flags for bounded task, file, and submission controls.
-- Risk: client-visible capability could diverge from owner, participant, state, or reviewer-material policy.
-- Rollback: revoke reader grant; command RPCs remain authoritative.

create or replace function public.get_project_workspace_capabilities(requested_workspace_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare role public.project_workspace_member_role; workspace_record public.project_workspaces;
begin
  role := public.project_workspace_access_role(requested_workspace_id);
  select * into workspace_record from public.project_workspaces where id = requested_workspace_id;
  if role is null or workspace_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'can_change_state', role = 'company_participant' and public.has_organization_permission(workspace_record.organization_id, 'owner'),
    'can_manage_tasks', role = 'company_participant' and public.has_organization_permission(workspace_record.organization_id, 'owner') and workspace_record.state in ('preparing', 'active', 'awaiting_submission'),
    'can_upload_files', role in ('talent_participant', 'company_participant') and workspace_record.state in ('active', 'awaiting_submission'),
    'can_create_submission', role = 'talent_participant' and workspace_record.state in ('active', 'awaiting_submission'),
    'review_material_assigned', role = 'reviewer'
  );
end;
$$;

revoke all on function public.get_project_workspace_capabilities(uuid) from public, anon;
grant execute on function public.get_project_workspace_capabilities(uuid) to authenticated;
