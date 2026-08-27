-- Phase 28 forward hardening. Owner: Reviews/Security. Reason: internal rubric validation, authorization, completion, lock, and trigger helpers must not remain callable through the exposed public RPC schema.
-- Rollback: forward compensation only; public commands retain independent authorization and this migration removes no user or audit history.

alter function public.project_rubric_payload_is_valid(jsonb) set schema private;
alter function public.require_active_company_rubric_author(uuid) set schema private;
alter function public.project_rubric_version_is_complete(uuid) set schema private;
alter function public.assert_project_rubric_version_immutable() set schema private;
alter function public.lock_project_workspace_rubric(uuid, uuid) set schema private;

create or replace function public.save_project_rubric(
  requested_project_id uuid,
  requested_rubric_id uuid,
  requested_rubric jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  project_record public.company_project_drafts := private.require_active_company_rubric_author(requested_project_id);
  rubric_record public.project_rubrics;
  version_record public.project_rubric_versions;
  current_version public.project_rubric_versions;
  requested_dimension jsonb;
  requested_descriptor jsonb;
  requested_calibration jsonb;
  dimension_record public.project_rubric_dimensions;
  calibration_submission_version_id uuid;
  next_version_number integer := 1;
  dimension_position integer := 1;
  calibration_position integer := 1;
begin
  if not private.project_rubric_payload_is_valid(requested_rubric) then raise exception 'VALIDATION_FAILED'; end if;
  if requested_rubric_id is null then
    select * into rubric_record from public.project_rubrics where project_id = project_record.id for update;
  else
    select * into rubric_record from public.project_rubrics
    where id = requested_rubric_id and project_id = project_record.id and organization_id = project_record.organization_id
    for update;
  end if;
  if rubric_record.id is null then
    insert into public.project_rubrics (project_id, organization_id, created_by_user_id)
    values (project_record.id, project_record.organization_id, actor_id)
    returning * into rubric_record;
    insert into public.project_rubric_events (rubric_id, project_id, organization_id, actor_user_id, event_type)
    values (rubric_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.created');
  elsif rubric_record.state = 'archived' then
    raise exception 'INVALID_STATE';
  end if;
  if rubric_record.current_version_id is not null then
    select * into current_version from public.project_rubric_versions where id = rubric_record.current_version_id for update;
  end if;
  if current_version.id is null or current_version.state <> 'draft' then
    if current_version.id is not null then
      select coalesce(max(version_number), 0) + 1 into next_version_number from public.project_rubric_versions where rubric_id = rubric_record.id;
    end if;
    insert into public.project_rubric_versions (rubric_id, project_id, organization_id, version_number, state, title, project_context, template_key, created_by_user_id)
    values (rubric_record.id, project_record.id, project_record.organization_id, next_version_number, 'draft', trim(requested_rubric->>'title'), trim(requested_rubric->>'project_context'), trim(requested_rubric->>'template_key'), actor_id)
    returning * into version_record;
  else
    update public.project_rubric_versions set title = trim(requested_rubric->>'title'), project_context = trim(requested_rubric->>'project_context'), template_key = trim(requested_rubric->>'template_key'), updated_at = now()
    where id = current_version.id returning * into version_record;
    delete from public.project_rubric_descriptors descriptor using public.project_rubric_dimensions dimension
    where descriptor.rubric_dimension_id = dimension.id and dimension.rubric_version_id = version_record.id;
    delete from public.project_rubric_calibration_examples where rubric_version_id = version_record.id;
    delete from public.project_rubric_dimensions where rubric_version_id = version_record.id;
  end if;
  for requested_dimension in select value from jsonb_array_elements(requested_rubric->'dimensions') loop
    insert into public.project_rubric_dimensions (rubric_version_id, rubric_id, project_id, organization_id, position, name, description, skill_keys, weight, priority, observable_criteria, evidence_examples, common_failure_modes, reviewer_guidance, feedback_visibility)
    values (version_record.id, rubric_record.id, project_record.id, project_record.organization_id, dimension_position, trim(requested_dimension->>'name'), trim(requested_dimension->>'description'), requested_dimension->'skill_keys', (requested_dimension->>'weight')::integer, (requested_dimension->>'priority')::public.project_rubric_dimension_priority, requested_dimension->'observable_criteria', requested_dimension->'evidence_examples', requested_dimension->'common_failure_modes', trim(requested_dimension->>'reviewer_guidance'), (requested_dimension->>'feedback_visibility')::public.project_rubric_feedback_visibility)
    returning * into dimension_record;
    for requested_descriptor in select value from jsonb_array_elements(requested_dimension->'descriptors') loop
      insert into public.project_rubric_descriptors (rubric_dimension_id, rubric_version_id, level, description)
      values (dimension_record.id, version_record.id, (requested_descriptor->>'level')::public.project_rubric_descriptor_level, trim(requested_descriptor->>'description'));
    end loop;
    dimension_position := dimension_position + 1;
  end loop;
  for requested_calibration in select value from jsonb_array_elements(requested_rubric->'calibration_examples') loop
    begin calibration_submission_version_id := nullif(trim(coalesce(requested_calibration->>'source_submission_version_id', '')), '')::uuid;
    exception when others then raise exception 'VALIDATION_FAILED'; end;
    if calibration_submission_version_id is not null and not exists (
      select 1 from public.project_workspace_submission_versions version
      join public.project_workspace_submissions submission on submission.id = version.submission_id
      join public.project_workspaces workspace on workspace.id = submission.workspace_id
      where version.id = calibration_submission_version_id and workspace.project_id = project_record.id and workspace.organization_id = project_record.organization_id
    ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    insert into public.project_rubric_calibration_examples (rubric_version_id, rubric_id, project_id, organization_id, position, title, description, source_url, source_submission_version_id, reviewer_guidance)
    values (version_record.id, rubric_record.id, project_record.id, project_record.organization_id, calibration_position, trim(requested_calibration->>'title'), trim(requested_calibration->>'description'), trim(coalesce(requested_calibration->>'source_url', '')), calibration_submission_version_id, trim(requested_calibration->>'reviewer_guidance'));
    calibration_position := calibration_position + 1;
  end loop;
  update public.project_rubrics set current_version_id = version_record.id, state = 'draft', archived_at = null, updated_at = now()
  where id = rubric_record.id returning * into rubric_record;
  insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
  values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.version_draft_saved', version_record.version_number);
  return jsonb_build_object('id', rubric_record.id, 'state', rubric_record.state, 'version_number', version_record.version_number);
end;
$$;

create or replace function public.transition_project_rubric(
  requested_project_id uuid,
  requested_rubric_id uuid,
  requested_state public.project_rubric_state
)
returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid(); project_record public.company_project_drafts := private.require_active_company_rubric_author(requested_project_id);
  rubric_record public.project_rubrics; version_record public.project_rubric_versions; previous_state public.project_rubric_state;
begin
  select * into rubric_record from public.project_rubrics where id = requested_rubric_id and project_id = project_record.id and organization_id = project_record.organization_id for update;
  if rubric_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  previous_state := rubric_record.state;
  select * into version_record from public.project_rubric_versions where id = rubric_record.current_version_id for update;
  if version_record.id is null then raise exception 'INVALID_STATE'; end if;
  if not ((previous_state = 'draft' and requested_state in ('ready_for_review', 'archived')) or (previous_state = 'ready_for_review' and requested_state in ('draft', 'published', 'archived')) or (previous_state = 'published' and requested_state in ('archived')) or (previous_state = 'locked' and requested_state in ('archived'))) then raise exception 'INVALID_STATE'; end if;
  if requested_state in ('ready_for_review', 'published') and not private.project_rubric_version_is_complete(version_record.id) then raise exception 'VALIDATION_FAILED'; end if;
  if requested_state = 'published' then
    update public.project_rubric_versions set state = 'published', published_at = now(), updated_at = now() where id = version_record.id returning * into version_record;
  end if;
  update public.project_rubrics set state = requested_state, archived_at = case when requested_state = 'archived' then now() else null end, updated_at = now() where id = rubric_record.id returning * into rubric_record;
  insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, previous_state, next_state, version_number)
  values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.state_changed', previous_state, requested_state, version_record.version_number);
  if requested_state = 'published' then
    insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
    values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.version_published', version_record.version_number);
  elsif requested_state = 'archived' then
    insert into public.project_rubric_events (rubric_id, rubric_version_id, project_id, organization_id, actor_user_id, event_type, version_number)
    values (rubric_record.id, version_record.id, project_record.id, project_record.organization_id, actor_id, 'rubric.archived', version_record.version_number);
  end if;
  return jsonb_build_object('id', rubric_record.id, 'state', rubric_record.state, 'version_number', version_record.version_number);
end;
$$;

create or replace function public.transition_project_workspace(
  requested_workspace_id uuid,
  requested_state public.project_workspace_state
)
returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); result public.project_workspaces; previous public.project_workspace_state;
begin
  result := public.require_active_company_workspace_owner(requested_workspace_id);
  select * into result from public.project_workspaces where id = result.id for update;
  previous := result.state;
  if not ((previous = 'preparing' and requested_state in ('active', 'paused', 'closed')) or (previous = 'active' and requested_state in ('paused', 'awaiting_submission', 'closed')) or (previous = 'paused' and requested_state in ('active', 'closed')) or (previous = 'awaiting_submission' and requested_state in ('active', 'under_review', 'closed')) or (previous = 'under_review' and requested_state in ('active', 'completed', 'closed')) or (previous = 'completed' and requested_state = 'closed')) then raise exception 'INVALID_STATE'; end if;
  if requested_state = 'under_review' then perform private.lock_project_workspace_rubric(result.id, actor_id); end if;
  update public.project_workspaces set state = requested_state, updated_at = now() where id = result.id returning * into result;
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state)
  values (result.id, result.organization_id, actor_id, 'workspace.state_changed', previous, requested_state);
  return jsonb_build_object('id', result.id, 'state', result.state);
end;
$$;

revoke all on function private.project_rubric_payload_is_valid(jsonb), private.require_active_company_rubric_author(uuid), private.project_rubric_version_is_complete(uuid), private.assert_project_rubric_version_immutable(), private.lock_project_workspace_rubric(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_project_rubric(uuid, uuid, jsonb), public.transition_project_rubric(uuid, uuid, public.project_rubric_state), public.get_company_project_rubric(uuid), public.get_workspace_locked_rubric(uuid), public.record_project_rubric_calibration_disagreement(uuid, uuid, text) from public, anon;
grant execute on function public.save_project_rubric(uuid, uuid, jsonb), public.transition_project_rubric(uuid, uuid, public.project_rubric_state), public.get_company_project_rubric(uuid), public.get_workspace_locked_rubric(uuid), public.record_project_rubric_calibration_disagreement(uuid, uuid, text) to authenticated;
