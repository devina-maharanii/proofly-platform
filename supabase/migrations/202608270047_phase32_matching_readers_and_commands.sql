-- Phase 32 matching readers and commands
-- Owner: Matching module. Reason: make every recommendation deterministic, consented, explainable, and auditable.
-- Risk: recommendation leakage after consent withdrawal, hidden scoring, and accidental application/hiring mutation.
-- Rollback: forward-only disable of public functions; retained audit and feedback records remain restricted.

create or replace function private.matching_requirement_payload_is_valid(
  requested_project public.company_project_drafts,
  requested_requirement jsonb
) returns boolean language plpgsql security definer stable set search_path = public as $$
declare expectation jsonb;
begin
  if jsonb_typeof(requested_requirement) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_requirement) key where key <> all(array['matching_enabled','required_evidence_expectations','availability_expectation','work_arrangement','timezone_expectation','collaboration_needs']))
    or coalesce(requested_requirement->>'matching_enabled','false') not in ('true','false')
    or jsonb_typeof(coalesce(requested_requirement->'required_evidence_expectations','{}'::jsonb)) <> 'object'
    or coalesce(requested_requirement->>'availability_expectation','not_specified') not in ('not_specified','available_now','limited_ok')
    or coalesce(requested_requirement->>'work_arrangement','not_specified') not in ('not_specified','remote','hybrid','onsite','flexible')
    or char_length(trim(coalesce(requested_requirement->>'timezone_expectation',''))) > 120
    or char_length(trim(coalesce(requested_requirement->>'collaboration_needs',''))) > 360
    or octet_length(requested_requirement::text) > 3000
    or lower(coalesce(requested_requirement->>'timezone_expectation','') || ' ' || coalesce(requested_requirement->>'collaboration_needs','')) ~ '(male|female|men|women|white|black|asian|religion|muslim|christian|hindu|disabled|disability|pregnant|married|single|nationality|citizenship|age|years[[:space:]]+old|young|old)'
    or exists (
      select 1 from jsonb_object_keys(coalesce(requested_requirement->'required_evidence_expectations','{}'::jsonb)) key
      where not (key = any(array(select jsonb_array_elements_text(requested_project.required_skills)))
        or key = any(array(select jsonb_array_elements_text(requested_project.helpful_skills))))
    )
  then return false; end if;

  for expectation in select value from jsonb_each(coalesce(requested_requirement->'required_evidence_expectations','{}'::jsonb)) loop
    if jsonb_typeof(expectation) <> 'string'
      or expectation #>> '{}' not in ('human_verified_public_proof','context_only') then
      return false;
    end if;
  end loop;

  if (requested_requirement->>'matching_enabled')::boolean
    and exists (
      select 1 from jsonb_array_elements_text(requested_project.required_skills) skill(skill_key)
      where coalesce(requested_requirement->'required_evidence_expectations'->>skill.skill_key, '') <> 'human_verified_public_proof'
    ) then return false; end if;
  return true;
end;
$$;

create or replace function public.save_matching_project_requirements(
  requested_project_id uuid,
  requested_requirement jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare project_record public.company_project_drafts := private.require_matching_company_project(requested_project_id);
  result public.matching_project_requirement_revisions; previous_version integer;
begin
  if requested_idempotency_key is null or not private.matching_requirement_payload_is_valid(project_record, requested_requirement) then
    raise exception 'VALIDATION_FAILED';
  end if;
  if exists (select 1 from public.matching_audit_events event where event.actor_user_id = auth.uid() and event.project_id = project_record.id and event.event_type = 'matching.project_requirement_saved' and event.idempotency_key = requested_idempotency_key) then
    select * into result from public.matching_project_requirement_revisions where project_id = project_record.id and is_current;
  else
    select coalesce(max(version), 0) into previous_version from public.matching_project_requirement_revisions where project_id = project_record.id for update;
    update public.matching_project_requirement_revisions set is_current = false where project_id = project_record.id and is_current;
    insert into public.matching_project_requirement_revisions (
      project_id, organization_id, version, source_project_version, is_current, matching_enabled,
      required_evidence_expectations, availability_expectation, work_arrangement, timezone_expectation,
      collaboration_needs, created_by_user_id
    ) values (
      project_record.id, project_record.organization_id, previous_version + 1, project_record.version, true,
      coalesce((requested_requirement->>'matching_enabled')::boolean, false),
      coalesce(requested_requirement->'required_evidence_expectations','{}'::jsonb),
      coalesce((requested_requirement->>'availability_expectation')::public.matching_requirement_availability, 'not_specified'),
      coalesce((requested_requirement->>'work_arrangement')::public.matching_work_arrangement, 'not_specified'),
      left(trim(coalesce(requested_requirement->>'timezone_expectation','')), 120),
      left(trim(coalesce(requested_requirement->>'collaboration_needs','')), 360), auth.uid()
    ) returning * into result;
    insert into public.matching_audit_events (actor_user_id, organization_id, project_id, event_type, idempotency_key, metadata)
    values (auth.uid(), project_record.organization_id, project_record.id, 'matching.project_requirement_saved', requested_idempotency_key,
      jsonb_build_object('requirement_version', result.version, 'source_project_version', result.source_project_version, 'matching_enabled', result.matching_enabled));
  end if;
  return jsonb_build_object(
    'version', result.version, 'source_project_version', result.source_project_version, 'matching_enabled', result.matching_enabled,
    'required_evidence_expectations', result.required_evidence_expectations, 'availability_expectation', result.availability_expectation,
    'work_arrangement', result.work_arrangement, 'timezone_expectation', result.timezone_expectation,
    'collaboration_needs', result.collaboration_needs, 'created_at', result.created_at
  );
end;
$$;

create or replace function public.get_matching_talent_preferences()
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare actor_id uuid := private.require_matching_talent_actor(); result public.matching_talent_preferences;
begin
  select * into result from public.matching_talent_preferences where user_id = actor_id;
  return jsonb_build_object(
    'project_recommendations_state', coalesce(result.project_recommendations_state, 'withdrawn'::public.matching_participation_state),
    'company_discoverability_state', coalesce(result.company_discoverability_state, 'withdrawn'::public.matching_participation_state),
    'availability_status', coalesce(result.availability_status, 'unknown'::public.matching_availability_status),
    'share_availability_with_companies', coalesce(result.share_availability_with_companies, false),
    'work_arrangement', coalesce(result.work_arrangement, 'not_specified'::public.matching_work_arrangement),
    'timezone', coalesce(result.timezone, 'UTC'),
    'application_capacity', coalesce(result.application_capacity, 'unknown'::public.matching_availability_status),
    'updated_at', result.updated_at
  );
end;
$$;

create or replace function public.get_matching_project_requirements(requested_project_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare project_record public.company_project_drafts := private.require_matching_company_project(requested_project_id);
  requirement public.matching_project_requirement_revisions;
begin
  select * into requirement from public.matching_project_requirement_revisions
  where project_id = project_record.id and is_current order by version desc limit 1;
  return jsonb_build_object(
    'project_id', project_record.id, 'project_version', project_record.version,
    'is_current_for_project', requirement.id is not null and requirement.source_project_version = project_record.version,
    'version', coalesce(requirement.version, 0), 'matching_enabled', coalesce(requirement.matching_enabled, false),
    'required_evidence_expectations', coalesce(requirement.required_evidence_expectations, '{}'::jsonb),
    'availability_expectation', coalesce(requirement.availability_expectation, 'not_specified'::public.matching_requirement_availability),
    'work_arrangement', coalesce(requirement.work_arrangement, 'not_specified'::public.matching_work_arrangement),
    'timezone_expectation', coalesce(requirement.timezone_expectation, ''),
    'collaboration_needs', coalesce(requirement.collaboration_needs, '')
  );
end;
$$;

create or replace function private.matching_talent_recommendation_items(
  target_talent_user_id uuid, maximum_count integer
) returns table (
  project_id uuid, organization_id uuid, public_id text, title text, organization_name text,
  required_skills text[], helpful_skills text[], requirement_version integer, source_project_version integer,
  proof_sources jsonb, fit_summary jsonb, input_sources jsonb, fingerprint text
) language sql security definer stable set search_path = public as $$
  with proofs as (
    select proof.*, profile.handle
    from private.matching_valid_public_proofs(target_talent_user_id) proof
    join public.talent_profile_publications profile on profile.user_id = target_talent_user_id
      and profile.state = 'published'
  ), candidates as (
    select project.id as target_project_id, project.organization_id as target_organization_id, project.public_id,
      project.title, organization.name as target_organization_name,
      array(select jsonb_array_elements_text(project.required_skills)) as target_required_skills,
      array(select jsonb_array_elements_text(project.helpful_skills)) as target_helpful_skills,
      requirement.version as target_requirement_version, requirement.source_project_version as target_source_project_version,
      array(select skill.skill_key from jsonb_array_elements_text(project.required_skills) skill(skill_key)
        where exists (select 1 from proofs proof where proof.skill_key = skill.skill_key)) as matched_required,
      array(select skill.skill_key from jsonb_array_elements_text(project.helpful_skills) skill(skill_key)
        where exists (select 1 from proofs proof where proof.skill_key = skill.skill_key)) as matched_helpful,
      array(select skill.skill_key from jsonb_array_elements_text(project.required_skills) skill(skill_key)
        where not exists (select 1 from proofs proof where proof.skill_key = skill.skill_key)) as missing_required,
      project.updated_at
    from public.company_project_drafts project
    join public.company_project_publications publication on publication.project_id = project.id
      and publication.state = 'accepting_applications'
    join public.matching_project_requirement_revisions requirement on requirement.project_id = project.id
      and requirement.is_current and requirement.matching_enabled and requirement.source_project_version = project.version
    join public.organizations organization on organization.id = project.organization_id
    where project.state = 'accepting_applications' and project.visibility = 'public'
      and project.project_type <> 'private_invite_only' and project.application_deadline >= current_date
  ), usable as (
    select * from candidates where cardinality(matched_required) > 0 or cardinality(matched_helpful) > 0
    order by cardinality(matched_required) desc, cardinality(matched_helpful) desc, updated_at desc, target_project_id
    limit least(greatest(coalesce(maximum_count, 0), 0), 25)
  )
  select usable.target_project_id, usable.target_organization_id, usable.public_id, usable.title, usable.target_organization_name,
    usable.target_required_skills, usable.target_helpful_skills, usable.target_requirement_version, usable.target_source_project_version,
    coalesce((select jsonb_agg(jsonb_build_object('proof_id', proof.proof_id, 'skill_key', proof.skill_key, 'evidence_public_id', proof.evidence_public_id, 'verified_at', proof.verified_at, 'href', '/talent/' || proof.handle) order by proof.verified_at desc, proof.proof_id)
      from proofs proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), '[]'::jsonb),
    jsonb_build_object(
      'reasons', to_jsonb(array_remove(array[
        case when cardinality(usable.matched_required) > 0 then format('Active human-verified proof supports required skill%s: %s.', case when cardinality(usable.matched_required) = 1 then '' else 's' end, array_to_string(usable.matched_required, ', ')) end,
        case when cardinality(usable.matched_helpful) > 0 then format('Active human-verified proof also supports helpful skill%s: %s.', case when cardinality(usable.matched_helpful) = 1 then '' else 's' end, array_to_string(usable.matched_helpful, ', ')) end
      ], null)),
      'gaps', to_jsonb(array_remove(array[
        case when cardinality(usable.missing_required) > 0 then format('Needs clarification: no active public human-verified proof for required skill%s %s.', case when cardinality(usable.missing_required) = 1 then '' else 's' end, array_to_string(usable.missing_required, ', ')) end
      ], null)),
      'limitations', jsonb_build_array('This recommendation is a deterministic discovery aid, not an eligibility, application, shortlist, invite, or hiring decision.', 'Missing information is shown as unknown and does not reduce a person to a score.'),
      'rule_order', jsonb_build_array('matched required proof coverage', 'matched helpful proof coverage', 'project update time', 'stable project identifier')
    ),
    jsonb_build_array(
      jsonb_build_object('type', 'project_requirement', 'project_id', usable.target_project_id, 'requirement_version', usable.target_requirement_version, 'source_project_version', usable.target_source_project_version, 'href', '/projects/' || usable.public_id),
      jsonb_build_object('type', 'active_public_human_verified_proof', 'proofs', coalesce((select jsonb_agg(jsonb_build_object('proof_id', proof.proof_id, 'skill_key', proof.skill_key, 'evidence_public_id', proof.evidence_public_id, 'verified_at', proof.verified_at, 'href', '/talent/' || proof.handle)) from proofs proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), '[]'::jsonb))
    ),
    md5(target_talent_user_id::text || usable.target_project_id::text || usable.target_requirement_version::text || coalesce((select string_agg(proof.proof_id::text, ',' order by proof.proof_id) from proofs proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), 'none'))
  from usable
$$;

create or replace function public.get_matching_projects_for_talent(maximum_count integer default 12)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := private.require_matching_talent_actor(); preference public.matching_talent_preferences;
  rule public.matching_rule_versions := private.matching_active_rule(); item record; recommendation_id uuid; recommendation_state public.matching_recommendation_state; recommendation_created boolean; items jsonb := '[]'::jsonb;
begin
  select * into preference from public.matching_talent_preferences where user_id = actor_id;
  if coalesce(preference.project_recommendations_state, 'withdrawn'::public.matching_participation_state) <> 'enabled' then
    return jsonb_build_object('participation_state', coalesce(preference.project_recommendations_state, 'withdrawn'::public.matching_participation_state), 'rule_version', rule.version, 'items', '[]'::jsonb, 'limitations', rule.rule_definition->'limitations');
  end if;
  for item in select * from private.matching_talent_recommendation_items(actor_id, maximum_count) loop
    insert into public.matching_recommendations (viewer_user_id, organization_id, project_id, talent_user_id, kind, rule_version, input_fingerprint, input_sources, fit_summary)
    values (actor_id, item.organization_id, item.project_id, actor_id, 'project_for_talent', rule.version, item.fingerprint, item.input_sources, item.fit_summary)
    on conflict (viewer_user_id, kind, project_id, talent_user_id, rule_version, input_fingerprint) do update set updated_at = public.matching_recommendations.updated_at
    returning id, state, (xmax = 0) into recommendation_id, recommendation_state, recommendation_created;
    if recommendation_created then
      insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, metadata)
      values (actor_id, item.organization_id, recommendation_id, item.project_id, rule.version, 'matching.recommendation_generated', jsonb_build_object('kind', 'project_for_talent', 'input_fingerprint', item.fingerprint));
    end if;
    if recommendation_state = 'active' then
      items := items || jsonb_build_array(jsonb_build_object('recommendation_id', recommendation_id, 'project', jsonb_build_object('public_id', item.public_id, 'title', item.title, 'organization_name', item.organization_name, 'required_skills', item.required_skills, 'helpful_skills', item.helpful_skills, 'href', '/projects/' || item.public_id), 'fit_summary', item.fit_summary, 'sources', item.input_sources));
    end if;
  end loop;
  return jsonb_build_object('participation_state', preference.project_recommendations_state, 'rule_version', rule.version, 'items', items, 'limitations', rule.rule_definition->'limitations');
end;
$$;

create or replace function private.matching_company_recommendation_items(
  target_project public.company_project_drafts, maximum_count integer
) returns table (
  talent_user_id uuid, handle text, display_name text, shared_availability text, project_id uuid,
  organization_id uuid, proof_sources jsonb, fit_summary jsonb, input_sources jsonb, fingerprint text
) language sql security definer stable set search_path = public as $$
  with requirement as (
    select * from public.matching_project_requirement_revisions
    where project_id = target_project.id and is_current and matching_enabled and source_project_version = target_project.version
  ), candidates as (
    select preference.user_id, publication.handle, coalesce(nullif(publication.snapshot->>'display_name',''), 'Talent') as target_display_name,
      case when preference.share_availability_with_companies then preference.availability_status::text else 'not_shared' end as visible_availability,
      preference.work_arrangement as talent_work_arrangement, preference.application_capacity,
      array(select skill.skill_key from jsonb_array_elements_text(target_project.required_skills) skill(skill_key)
        where exists (select 1 from private.matching_valid_public_proofs(preference.user_id) proof where proof.skill_key = skill.skill_key)) as matched_required,
      array(select skill.skill_key from jsonb_array_elements_text(target_project.helpful_skills) skill(skill_key)
        where exists (select 1 from private.matching_valid_public_proofs(preference.user_id) proof where proof.skill_key = skill.skill_key)) as matched_helpful,
      array(select skill.skill_key from jsonb_array_elements_text(target_project.required_skills) skill(skill_key)
        where not exists (select 1 from private.matching_valid_public_proofs(preference.user_id) proof where proof.skill_key = skill.skill_key)) as missing_required
    from public.matching_talent_preferences preference
    join public.talent_profile_publications publication on publication.user_id = preference.user_id and publication.state = 'published'
    cross join requirement
    where preference.company_discoverability_state = 'enabled'
      and preference.application_capacity <> 'unavailable'
  ), usable as (
    select * from candidates where cardinality(matched_required) > 0 or cardinality(matched_helpful) > 0
    order by cardinality(matched_required) desc, cardinality(matched_helpful) desc, handle
    limit least(greatest(coalesce(maximum_count, 0), 0), 25)
  )
  select usable.user_id, usable.handle, usable.target_display_name, usable.visible_availability, target_project.id, target_project.organization_id,
    coalesce((select jsonb_agg(jsonb_build_object('proof_id', proof.proof_id, 'skill_key', proof.skill_key, 'evidence_public_id', proof.evidence_public_id, 'verified_at', proof.verified_at, 'href', '/talent/' || usable.handle) order by proof.verified_at desc, proof.proof_id)
      from private.matching_valid_public_proofs(usable.user_id) proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), '[]'::jsonb),
    jsonb_build_object(
      'reasons', to_jsonb(array_remove(array[
        case when cardinality(usable.matched_required) > 0 then format('Active human-verified proof supports required skill%s: %s.', case when cardinality(usable.matched_required) = 1 then '' else 's' end, array_to_string(usable.matched_required, ', ')) end,
        case when cardinality(usable.matched_helpful) > 0 then format('Active human-verified proof also supports helpful skill%s: %s.', case when cardinality(usable.matched_helpful) = 1 then '' else 's' end, array_to_string(usable.matched_helpful, ', ')) end,
        case when usable.visible_availability in ('available','limited') then 'Voluntarily shared availability is ' || usable.visible_availability || '.' end
      ], null)),
      'gaps', to_jsonb(array_remove(array[
        case when cardinality(usable.missing_required) > 0 then format('Needs clarification: no active public human-verified proof for required skill%s %s.', case when cardinality(usable.missing_required) = 1 then '' else 's' end, array_to_string(usable.missing_required, ', ')) end,
        case when usable.visible_availability = 'not_shared' then 'Availability is not shared; confirm it directly only through an approved workflow.' end
      ], null)),
      'limitations', jsonb_build_array('This is a deterministic evidence recommendation, not an eligibility, shortlist, invite, application, or hiring decision.', 'Private messages, profile claims, activity, protected attributes, identity signals, geography, and popularity are excluded.'),
      'rule_order', jsonb_build_array('matched required proof coverage', 'matched helpful proof coverage', 'public handle')
    ),
    jsonb_build_array(
      jsonb_build_object('type', 'project_requirement', 'project_id', target_project.id, 'href', '/company/projects/' || target_project.id),
      jsonb_build_object('type', 'active_public_human_verified_proof', 'proofs', coalesce((select jsonb_agg(jsonb_build_object('proof_id', proof.proof_id, 'skill_key', proof.skill_key, 'evidence_public_id', proof.evidence_public_id, 'verified_at', proof.verified_at, 'href', '/talent/' || usable.handle)) from private.matching_valid_public_proofs(usable.user_id) proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), '[]'::jsonb))
    ),
    md5(usable.user_id::text || target_project.id::text || coalesce((select max(version)::text from requirement), '0') || coalesce((select string_agg(proof.proof_id::text, ',' order by proof.proof_id) from private.matching_valid_public_proofs(usable.user_id) proof where proof.skill_key = any(usable.matched_required || usable.matched_helpful)), 'none'))
  from usable
$$;

create or replace function public.get_matching_talent_recommendations(
  requested_project_id uuid, maximum_count integer default 12
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare project_record public.company_project_drafts := private.require_matching_company_project(requested_project_id);
  rule public.matching_rule_versions := private.matching_active_rule(); item record; recommendation_id uuid; recommendation_state public.matching_recommendation_state; recommendation_created boolean; items jsonb := '[]'::jsonb;
begin
  if not private.matching_project_is_recommendable(project_record.id) then
    return jsonb_build_object('project_id', project_record.id, 'rule_version', rule.version, 'items', '[]'::jsonb, 'state', 'requirements_not_current_or_project_not_recommendable', 'limitations', rule.rule_definition->'limitations');
  end if;
  for item in select * from private.matching_company_recommendation_items(project_record, maximum_count) loop
    insert into public.matching_recommendations (viewer_user_id, organization_id, project_id, talent_user_id, kind, rule_version, input_fingerprint, input_sources, fit_summary)
    values (auth.uid(), item.organization_id, item.project_id, item.talent_user_id, 'talent_for_project', rule.version, item.fingerprint, item.input_sources, item.fit_summary)
    on conflict (viewer_user_id, kind, project_id, talent_user_id, rule_version, input_fingerprint) do update set updated_at = public.matching_recommendations.updated_at
    returning id, state, (xmax = 0) into recommendation_id, recommendation_state, recommendation_created;
    if recommendation_created then
      insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, metadata)
      values (auth.uid(), item.organization_id, recommendation_id, item.project_id, rule.version, 'matching.recommendation_generated', jsonb_build_object('kind', 'talent_for_project', 'input_fingerprint', item.fingerprint));
    end if;
    if recommendation_state = 'active' then
      items := items || jsonb_build_array(jsonb_build_object('recommendation_id', recommendation_id, 'talent', jsonb_build_object('handle', item.handle, 'display_name', item.display_name, 'availability', item.shared_availability, 'href', '/talent/' || item.handle), 'fit_summary', item.fit_summary, 'sources', item.input_sources));
    end if;
  end loop;
  return jsonb_build_object('project_id', project_record.id, 'rule_version', rule.version, 'items', items, 'state', 'ready', 'limitations', rule.rule_definition->'limitations');
end;
$$;

create or replace function private.require_matching_recommendation_for_viewer(requested_recommendation_id uuid)
returns public.matching_recommendations language plpgsql security definer stable set search_path = public as $$
declare result public.matching_recommendations;
begin
  select * into result from public.matching_recommendations where id = requested_recommendation_id and viewer_user_id = auth.uid();
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if (result.kind = 'project_for_talent' and not exists (
    select 1 from private.matching_talent_recommendation_items(auth.uid(), 25) item
    where item.project_id = result.project_id and item.fingerprint = result.input_fingerprint
  )) or (result.kind = 'talent_for_project' and not exists (
    select 1 from public.company_project_drafts project
    where project.id = result.project_id and private.matching_project_is_recommendable(project.id)
      and exists (
        select 1 from private.matching_company_recommendation_items(project, 25) item
        where item.talent_user_id = result.talent_user_id and item.fingerprint = result.input_fingerprint
      )
  )) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function public.dismiss_matching_recommendation(
  requested_recommendation_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare recommendation public.matching_recommendations := private.require_matching_recommendation_for_viewer(requested_recommendation_id);
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  update public.matching_recommendations set state = 'dismissed', updated_at = now()
  where id = recommendation.id and state = 'active';
  insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, idempotency_key)
  values (auth.uid(), recommendation.organization_id, recommendation.id, recommendation.project_id, recommendation.rule_version, 'matching.recommendation_dismissed', requested_idempotency_key)
  on conflict (actor_user_id, event_type, idempotency_key) do nothing;
  return jsonb_build_object('recommendation_id', recommendation.id, 'state', 'dismissed');
end;
$$;

create or replace function public.record_matching_recommendation_feedback(
  requested_recommendation_id uuid, requested_feedback_type public.matching_feedback_type,
  requested_detail text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare recommendation public.matching_recommendations := private.require_matching_recommendation_for_viewer(requested_recommendation_id); feedback_id uuid;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_detail,''))) > 600 then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.matching_recommendation_feedback (recommendation_id, actor_user_id, feedback_type, detail, idempotency_key)
  values (recommendation.id, auth.uid(), requested_feedback_type, left(trim(coalesce(requested_detail,'')),600), requested_idempotency_key)
  on conflict (actor_user_id, idempotency_key) do nothing
  returning id into feedback_id;
  if feedback_id is null then
    select id into feedback_id from public.matching_recommendation_feedback
    where actor_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  end if;
  insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, idempotency_key)
  values (auth.uid(), recommendation.organization_id, recommendation.id, recommendation.project_id, recommendation.rule_version, 'matching.feedback_recorded', requested_idempotency_key)
  on conflict (actor_user_id, event_type, idempotency_key) do nothing;
  return jsonb_build_object('feedback_id', feedback_id, 'recommendation_id', recommendation.id);
end;
$$;

create or replace function public.report_matching_recommendation(
  requested_recommendation_id uuid, requested_category public.matching_feedback_type,
  requested_detail text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare recommendation public.matching_recommendations := private.require_matching_recommendation_for_viewer(requested_recommendation_id); report_id uuid;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_detail,''))) > 600 then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.matching_recommendation_reports (recommendation_id, reporter_user_id, category, detail, idempotency_key)
  values (recommendation.id, auth.uid(), requested_category, left(trim(coalesce(requested_detail,'')),600), requested_idempotency_key)
  on conflict (reporter_user_id, idempotency_key) do nothing
  returning id into report_id;
  if report_id is null then
    select id into report_id from public.matching_recommendation_reports
    where reporter_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  end if;
  update public.matching_recommendations set state = 'reported', updated_at = now() where id = recommendation.id and state = 'active';
  insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, idempotency_key)
  values (auth.uid(), recommendation.organization_id, recommendation.id, recommendation.project_id, recommendation.rule_version, 'matching.report_recorded', requested_idempotency_key)
  on conflict (actor_user_id, event_type, idempotency_key) do nothing;
  return jsonb_build_object('report_id', report_id, 'recommendation_id', recommendation.id, 'state', 'reported');
end;
$$;

create or replace function public.record_matching_human_override(
  requested_recommendation_id uuid, requested_action public.matching_company_action,
  requested_rationale text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare recommendation public.matching_recommendations := private.require_matching_recommendation_for_viewer(requested_recommendation_id); override_id uuid;
  project_record public.company_project_drafts;
begin
  if requested_idempotency_key is null or recommendation.kind <> 'talent_for_project' or char_length(trim(coalesce(requested_rationale,''))) > 600 then raise exception 'VALIDATION_FAILED'; end if;
  project_record := private.require_matching_company_project(recommendation.project_id);
  if project_record.organization_id <> recommendation.organization_id then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.matching_human_overrides (recommendation_id, organization_id, actor_user_id, action, rationale, idempotency_key)
  values (recommendation.id, project_record.organization_id, auth.uid(), requested_action, left(trim(coalesce(requested_rationale,'')),600), requested_idempotency_key)
  on conflict (actor_user_id, idempotency_key) do nothing
  returning id into override_id;
  if override_id is null then
    select id into override_id from public.matching_human_overrides
    where actor_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  end if;
  insert into public.matching_audit_events (actor_user_id, organization_id, recommendation_id, project_id, rule_version, event_type, idempotency_key, metadata)
  values (auth.uid(), project_record.organization_id, recommendation.id, project_record.id, recommendation.rule_version, 'matching.human_override_recorded', requested_idempotency_key, jsonb_build_object('action', requested_action))
  on conflict (actor_user_id, event_type, idempotency_key) do nothing;
  return jsonb_build_object('override_id', override_id, 'recommendation_id', recommendation.id, 'action', requested_action, 'notice', 'This records an accountable human review action. It does not change an application, invite, shortlist, or hiring decision.');
end;
$$;

create or replace function public.record_matching_ai_assistance(
  requested_project_id uuid, requested_state public.matching_ai_assistance_state,
  requested_adapter_id text, requested_model_reference text, requested_prompt_version text,
  requested_source_references jsonb, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare project_record public.company_project_drafts := private.require_matching_company_project(requested_project_id); audit_id uuid;
begin
  if requested_idempotency_key is null or requested_state not in ('disabled','requested','failed')
    or char_length(trim(coalesce(requested_adapter_id,''))) not between 3 and 120
    or char_length(trim(coalesce(requested_model_reference,''))) > 160
    or char_length(trim(coalesce(requested_prompt_version,''))) > 80
    or jsonb_typeof(requested_source_references) <> 'array' or jsonb_array_length(requested_source_references) > 12 then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.matching_ai_assistance_audits (project_id, actor_user_id, state, adapter_id, model_reference, prompt_version, source_references, idempotency_key)
  values (project_record.id, auth.uid(), requested_state, trim(requested_adapter_id), left(trim(coalesce(requested_model_reference,'')),160), left(trim(coalesce(requested_prompt_version,'')),80), requested_source_references, requested_idempotency_key)
  on conflict (actor_user_id, idempotency_key) do nothing
  returning id into audit_id;
  if audit_id is null then
    select id into audit_id from public.matching_ai_assistance_audits
    where actor_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  end if;
  insert into public.matching_audit_events (actor_user_id, organization_id, project_id, event_type, idempotency_key, metadata)
  values (auth.uid(), project_record.organization_id, project_record.id, 'matching.ai_assistance_recorded', requested_idempotency_key, jsonb_build_object('state', requested_state, 'adapter_id', trim(requested_adapter_id)))
  on conflict (actor_user_id, event_type, idempotency_key) do nothing;
  return jsonb_build_object('audit_id', audit_id, 'state', requested_state);
end;
$$;

create or replace function public.get_matching_administration_summary(maximum_count integer default 80)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
begin
  perform private.require_matching_administrator();
  return jsonb_build_object(
    'rules', coalesce((select jsonb_agg(jsonb_build_object('version', rule.version, 'state', rule.state, 'strategy', rule.strategy, 'rule_definition', rule.rule_definition, 'created_at', rule.created_at) order by rule.created_at desc) from public.matching_rule_versions rule), '[]'::jsonb),
    'metrics', coalesce((select jsonb_agg(jsonb_build_object('metric_key', metric.metric_key, 'description', metric.description, 'measurement_boundary', metric.measurement_boundary) order by metric.metric_key) from public.matching_evaluation_metric_definitions metric), '[]'::jsonb),
    'counts', jsonb_build_object('active_recommendations', (select count(*) from public.matching_recommendations where state = 'active'), 'feedback_records', (select count(*) from public.matching_recommendation_feedback), 'reports', (select count(*) from public.matching_recommendation_reports), 'human_review_actions', (select count(*) from public.matching_human_overrides)),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'rule_version', event.rule_version, 'occurred_at', event.occurred_at, 'metadata', event.metadata) order by event.occurred_at desc, event.id desc) from (select * from public.matching_audit_events order by occurred_at desc, id desc limit least(greatest(coalesce(maximum_count,0),0),80)) event), '[]'::jsonb)
  );
end;
$$;

revoke all on function private.matching_requirement_payload_is_valid(public.company_project_drafts, jsonb), private.matching_talent_recommendation_items(uuid, integer), private.matching_company_recommendation_items(public.company_project_drafts, integer), private.require_matching_recommendation_for_viewer(uuid) from public, anon, authenticated;
revoke all on function public.save_matching_project_requirements(uuid, jsonb, uuid), public.get_matching_talent_preferences(), public.get_matching_project_requirements(uuid), public.get_matching_projects_for_talent(integer), public.get_matching_talent_recommendations(uuid, integer), public.dismiss_matching_recommendation(uuid, uuid), public.record_matching_recommendation_feedback(uuid, public.matching_feedback_type, text, uuid), public.report_matching_recommendation(uuid, public.matching_feedback_type, text, uuid), public.record_matching_human_override(uuid, public.matching_company_action, text, uuid), public.record_matching_ai_assistance(uuid, public.matching_ai_assistance_state, text, text, text, jsonb, uuid), public.get_matching_administration_summary(integer) from public, anon;
grant execute on function public.save_matching_project_requirements(uuid, jsonb, uuid), public.get_matching_talent_preferences(), public.get_matching_project_requirements(uuid), public.get_matching_projects_for_talent(integer), public.get_matching_talent_recommendations(uuid, integer), public.dismiss_matching_recommendation(uuid, uuid), public.record_matching_recommendation_feedback(uuid, public.matching_feedback_type, text, uuid), public.report_matching_recommendation(uuid, public.matching_feedback_type, text, uuid), public.record_matching_human_override(uuid, public.matching_company_action, text, uuid), public.record_matching_ai_assistance(uuid, public.matching_ai_assistance_state, text, text, text, jsonb, uuid), public.get_matching_administration_summary(integer) to authenticated;
