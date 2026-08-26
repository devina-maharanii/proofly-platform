-- Phase 26 — Private task, artifact, and submission readers
-- Owner: Workspaces/Evidence modules. Reason: expose only participant-scoped metadata and server-only storage targets through explicit readers.
-- Risk: task, file object-key, submission draft, or reviewer-material leakage.
-- Rollback: revoke reader grants; retain restricted records and audit history.

create or replace function public.get_project_workspace_task(requested_task_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); task_record public.project_workspace_tasks; role public.project_workspace_member_role;
begin
  select * into task_record from public.project_workspace_tasks where id = requested_task_id;
  if task_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  role := public.project_workspace_access_role(task_record.workspace_id);
  if role is null or role = 'reviewer' or (role = 'talent_participant' and task_record.assigned_user_id is distinct from actor_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'id', task_record.id, 'workspace_id', task_record.workspace_id, 'title', task_record.title,
    'description', task_record.description, 'state', task_record.state, 'priority', task_record.priority,
    'due_date', task_record.due_date, 'acceptance_criteria', task_record.acceptance_criteria,
    'dependency_task_ids', task_record.dependency_task_ids, 'is_assigned_to_current_actor', task_record.assigned_user_id = actor_id,
    'can_edit', role = 'company_participant' and public.has_organization_permission(task_record.organization_id, 'owner'),
    'can_transition', role = 'company_participant' or (role = 'talent_participant' and task_record.assigned_user_id = actor_id)
  );
end;
$$;

create or replace function public.get_project_workspace_files(requested_workspace_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare role public.project_workspace_member_role;
begin
  role := public.project_workspace_access_role(requested_workspace_id);
  if role is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', file.id, 'task_id', file.task_id, 'display_name', file.display_name, 'description', file.description,
      'lifecycle_state', file.lifecycle_state, 'is_owned_by_current_actor', file.owner_user_id = auth.uid(),
      'created_at', file.created_at, 'updated_at', file.updated_at,
      'versions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', version.id, 'version_number', version.version_number, 'original_filename', version.original_filename,
        'content_type', version.content_type, 'size_bytes', version.size_bytes, 'scan_state', version.scan_state,
        'access_scope', version.access_scope, 'created_at', version.created_at,
        'can_download', version.scan_state = 'clean' and (role <> 'reviewer' or version.access_scope = 'review_material')
      ) order by version.version_number desc) from public.project_workspace_file_versions version where version.file_id = file.id), '[]'::jsonb)
    ) order by file.updated_at desc)
    from public.project_workspace_files file
    where file.workspace_id = requested_workspace_id
      and (role <> 'reviewer' or exists (select 1 from public.project_workspace_file_versions version where version.file_id = file.id and version.access_scope = 'review_material' and version.scan_state = 'clean'))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_project_workspace_submission(requested_workspace_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); role public.project_workspace_member_role; submission_record public.project_workspace_submissions;
begin
  role := public.project_workspace_access_role(requested_workspace_id);
  if role is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into submission_record from public.project_workspace_submissions submission
  where submission.workspace_id = requested_workspace_id
    and (role <> 'talent_participant' or submission.talent_user_id = actor_id);
  if submission_record.id is null then return null; end if;
  if role = 'reviewer' and submission_record.state not in ('submitted', 'resubmitted', 'under_review', 'changes_requested') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'id', submission_record.id, 'workspace_id', submission_record.workspace_id, 'task_id', submission_record.task_id,
    'state', submission_record.state, 'current_version_number', submission_record.current_version_number,
    'can_edit', role = 'talent_participant' and submission_record.state in ('draft', 'changes_requested'),
    'versions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', version.id, 'version_number', version.version_number, 'summary', version.summary,
      'problem_interpretation', version.problem_interpretation, 'approach_and_decisions', version.approach_and_decisions,
      'deliverables', version.deliverables, 'demo_or_repository_link', version.demo_or_repository_link,
      'known_limitations', version.known_limitations, 'completion_context', version.completion_context,
      'ownership_confirmed', version.ownership_confirmed, 'attribution_confirmed', version.attribution_confirmed,
      'created_at', version.created_at, 'files', coalesce((select jsonb_agg(jsonb_build_object(
        'id', file_version.id, 'file_id', file.id, 'display_name', file.display_name,
        'version_number', file_version.version_number, 'original_filename', file_version.original_filename,
        'content_type', file_version.content_type, 'size_bytes', file_version.size_bytes,
        'scan_state', file_version.scan_state, 'can_download', file_version.scan_state = 'clean' and (role <> 'reviewer' or file_version.access_scope = 'review_material')
      ) order by file.display_name) from public.project_workspace_submission_version_files link join public.project_workspace_file_versions file_version on file_version.id = link.file_version_id join public.project_workspace_files file on file.id = file_version.file_id where link.submission_version_id = version.id), '[]'::jsonb)
    ) order by version.version_number desc) from public.project_workspace_submission_versions version where version.submission_id = submission_record.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_project_workspace_file_download_target(requested_file_version_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare version_record public.project_workspace_file_versions; role public.project_workspace_member_role;
begin
  select * into version_record from public.project_workspace_file_versions where id = requested_file_version_id;
  if version_record.id is null or version_record.scan_state <> 'clean' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  role := public.project_workspace_access_role(version_record.workspace_id);
  if role is null or (role = 'reviewer' and version_record.access_scope <> 'review_material') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object('bucket', version_record.storage_bucket, 'object_key', version_record.object_key, 'original_filename', version_record.original_filename);
end;
$$;

revoke all on function public.get_project_workspace_task(uuid), public.get_project_workspace_files(uuid), public.get_project_workspace_submission(uuid), public.get_project_workspace_file_download_target(uuid) from public, anon;
grant execute on function public.get_project_workspace_task(uuid), public.get_project_workspace_files(uuid), public.get_project_workspace_submission(uuid), public.get_project_workspace_file_download_target(uuid) to authenticated;
