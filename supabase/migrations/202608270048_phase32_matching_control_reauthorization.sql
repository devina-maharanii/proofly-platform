-- Phase 32 control reauthorization hardening
-- Owner: Matching module. Reason: consent or active-role changes must immediately remove recommendation controls.
-- Risk: stale recommendation state being dismissed, reported, or otherwise controlled after scope loss.
-- Rollback: forward-only replacement; no recommendation, feedback, or audit history is deleted.

create or replace function private.require_matching_recommendation_for_viewer(requested_recommendation_id uuid)
returns public.matching_recommendations language plpgsql security definer stable set search_path = public, private as $$
declare result public.matching_recommendations;
begin
  select * into result
  from public.matching_recommendations
  where id = requested_recommendation_id and viewer_user_id = auth.uid();
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;

  if result.kind = 'project_for_talent' then
    perform private.require_matching_talent_actor();
    if not exists (
      select 1 from public.matching_talent_preferences preference
      where preference.user_id = auth.uid()
        and preference.project_recommendations_state = 'enabled'
    ) or not exists (
      select 1 from private.matching_talent_recommendation_items(auth.uid(), 25) item
      where item.project_id = result.project_id and item.fingerprint = result.input_fingerprint
    ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  else
    perform private.require_matching_company_project(result.project_id);
    if not exists (
      select 1 from public.company_project_drafts project
      where project.id = result.project_id and private.matching_project_is_recommendable(project.id)
        and exists (
          select 1 from private.matching_company_recommendation_items(project, 25) item
          where item.talent_user_id = result.talent_user_id and item.fingerprint = result.input_fingerprint
        )
    ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  end if;
  return result;
end;
$$;

revoke all on function private.require_matching_recommendation_for_viewer(uuid) from public, anon, authenticated;
