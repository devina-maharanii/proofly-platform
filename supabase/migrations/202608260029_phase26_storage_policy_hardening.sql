-- Phase 26 — Storage policy hardening
-- Owner: Workspaces/Evidence modules. Reason: keep private Storage policy helpers non-exposed and harden function search paths.
-- Risk: direct REST RPC exposure for object-path helpers or mutable function search paths.
-- Rollback: forward-only policy replacement; existing private objects remain unreachable without participant authorization.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.workspace_task_transition_allowed(
  current_state public.project_workspace_task_state,
  requested_state public.project_workspace_task_state
) returns boolean language sql immutable set search_path = public as $$
  select (current_state = 'backlog' and requested_state in ('ready', 'cancelled'))
      or (current_state = 'ready' and requested_state in ('backlog', 'in_progress', 'blocked', 'cancelled'))
      or (current_state = 'in_progress' and requested_state in ('ready', 'blocked', 'in_review', 'done'))
      or (current_state = 'blocked' and requested_state in ('ready', 'in_progress', 'cancelled'))
      or (current_state = 'in_review' and requested_state in ('in_progress', 'blocked', 'done'))
      or (current_state = 'done' and requested_state = 'in_progress')
      or (current_state = 'cancelled' and requested_state = 'backlog')
$$;

create or replace function private.can_insert_project_workspace_storage_object(requested_object_key text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.project_workspace_file_versions version where version.storage_bucket = 'proofly-private' and version.object_key = requested_object_key and version.uploaded_by_user_id = auth.uid() and version.scan_state = 'pending')
$$;

create or replace function private.can_read_project_workspace_storage_object(requested_object_key text)
returns boolean language plpgsql security definer stable set search_path = public as $$
declare version_record public.project_workspace_file_versions; access_role public.project_workspace_member_role;
begin
  select * into version_record from public.project_workspace_file_versions where storage_bucket = 'proofly-private' and object_key = requested_object_key and scan_state = 'clean';
  if version_record.id is null then return false; end if;
  access_role := public.project_workspace_access_role(version_record.workspace_id);
  return access_role in ('talent_participant', 'company_participant') or (access_role = 'reviewer' and version_record.access_scope = 'review_material');
end;
$$;

drop policy if exists "workspace file objects are private on insert" on storage.objects;
drop policy if exists "workspace file objects are private on read" on storage.objects;
create policy "workspace file objects are private on insert" on storage.objects for insert to authenticated with check (bucket_id = 'proofly-private' and private.can_insert_project_workspace_storage_object(name));
create policy "workspace file objects are private on read" on storage.objects for select to authenticated using (bucket_id = 'proofly-private' and private.can_read_project_workspace_storage_object(name));

revoke all on function public.can_insert_project_workspace_storage_object(text), public.can_read_project_workspace_storage_object(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can_insert_project_workspace_storage_object(text), private.can_read_project_workspace_storage_object(text) to authenticated;
