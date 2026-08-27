-- Phase 28 forward hardening. Owner: Reviews/Security. Reason: rubric drafting may be delegated to hiring members, while publication and archival remain explicit owner decisions.

create or replace function private.require_active_company_rubric_owner(requested_project_id uuid)
returns public.company_project_drafts
language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); organization_id uuid := public.require_active_company_project_context(true); project_record public.company_project_drafts;
begin
  select * into project_record
  from public.company_project_drafts project
  where project.id = requested_project_id and project.organization_id = organization_id;
  if actor_id is null or project_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return project_record;
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
  actor_id uuid := auth.uid(); project_record public.company_project_drafts;
  rubric_record public.project_rubrics; version_record public.project_rubric_versions; previous_state public.project_rubric_state;
begin
  project_record := private.require_active_company_rubric_author(requested_project_id);
  if requested_state in ('published', 'archived') then
    project_record := private.require_active_company_rubric_owner(requested_project_id);
  end if;
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

revoke all on function private.require_active_company_rubric_owner(uuid) from public, anon, authenticated;
revoke all on function public.transition_project_rubric(uuid, uuid, public.project_rubric_state) from public, anon;
grant execute on function public.transition_project_rubric(uuid, uuid, public.project_rubric_state) to authenticated;
