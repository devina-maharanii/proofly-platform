-- Phase 25 follow-up hardening: an active reviewer membership is insufficient by itself; explicit review material is required before the workspace reader resolves reviewer access.
-- Rollback: forward compensation only; revoke reviewer workspace reader grant or remove review-material grants without deleting workspace/audit history.

alter table public.project_workspace_members
  add column review_material_granted boolean not null default false;

alter table public.project_workspace_members
  add constraint project_workspace_review_material_role_check
  check (role = 'reviewer' or review_material_granted = false);

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
      or (
        member.role = 'reviewer'
        and context.active_role = 'reviewer'
        and member.review_material_granted = true
      )
    )
  order by case member.role when 'talent_participant' then 1 else 2 end
  limit 1;
  return result;
end;
$$;
