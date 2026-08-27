-- Phase 29 forward workflow/privacy hardening.
-- Preserves all recorded history while correcting state observability, client-safe idempotency,
-- assignment authority, restricted reviewer observations, appeal resolution, and revocation audit detail.
-- Rollback: forward compensation only; no verification, review, proof, appeal, or audit rows are deleted.

alter table public.project_verification_events
  add column metadata jsonb not null default '{}'::jsonb
  check (jsonb_typeof(metadata) = 'object');

create or replace function public.prepare_project_verification(
  requested_workspace_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  workspace_record public.project_workspaces;
  submission_record public.project_workspace_submissions;
  version_record public.project_workspace_submission_versions;
  verification_record public.project_verifications;
  rubric_version_id uuid;
  prior_state public.verification_state;
begin
  workspace_record := private.require_company_verification_owner(requested_workspace_id);
  select * into submission_record
    from public.project_workspace_submissions
    where workspace_id = workspace_record.id and state in ('submitted', 'resubmitted')
    for update;
  if submission_record.id is null then raise exception 'INVALID_STATE'; end if;
  select * into version_record
    from public.project_workspace_submission_versions
    where submission_id = submission_record.id and version_number = submission_record.current_version_number
    for update;
  if version_record.id is null
    or not version_record.ownership_confirmed
    or not version_record.attribution_confirmed
    or not exists (
      select 1
      from public.project_workspace_submission_version_files file_link
      join public.project_workspace_file_versions file_version on file_version.id = file_link.file_version_id
      where file_link.submission_version_id = version_record.id and file_version.scan_state = 'clean'
    )
  then raise exception 'VALIDATION_FAILED'; end if;
  rubric_version_id := private.lock_project_workspace_rubric(workspace_record.id, actor_id);
  select * into verification_record from public.project_verifications where workspace_id = workspace_record.id for update;
  if verification_record.id is not null and exists (
    select 1 from public.project_verification_events event
    where event.verification_id = verification_record.id and event.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'idempotent', true);
  end if;
  if verification_record.id is null then
    insert into public.project_verifications (
      workspace_id, organization_id, submission_id, current_submission_version_id,
      rubric_version_id, talent_user_id, state, created_by_user_id
    ) values (
      workspace_record.id, workspace_record.organization_id, submission_record.id,
      version_record.id, rubric_version_id, submission_record.talent_user_id,
      'ready_for_assignment', actor_id
    ) returning * into verification_record;
    prior_state := null;
  elsif verification_record.state = 'changes_requested' and submission_record.state = 'resubmitted' then
    prior_state := verification_record.state;
    update public.project_verifications
      set current_submission_version_id = version_record.id,
          state = 'resubmitted',
          updated_at = now()
      where id = verification_record.id
      returning * into verification_record;
  else
    raise exception 'INVALID_STATE';
  end if;
  update public.project_workspace_submissions
    set state = 'under_review', updated_at = now()
    where id = submission_record.id;
  update public.project_workspaces
    set state = 'under_review', updated_at = now()
    where id = workspace_record.id;
  insert into public.project_verification_events (
    verification_id, workspace_id, organization_id, actor_user_id, event_type,
    previous_state, next_state, idempotency_key
  ) values (
    verification_record.id, workspace_record.id, workspace_record.organization_id,
    actor_id, 'verification.prepared', prior_state, verification_record.state,
    requested_idempotency_key
  );
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, event_type)
    values (workspace_record.id, workspace_record.organization_id, actor_id, 'workspace.verification_event');
  return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state);
end;
$$;

create or replace function public.assign_project_verification_reviewer(
  requested_verification_id uuid,
  requested_reviewer_user_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  verification_record public.project_verifications;
  review_record public.project_verification_reviews;
  prior_state public.verification_state;
  is_platform_admin boolean := private.verification_actor_is_admin();
begin
  if actor_id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  if verification_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if not is_platform_admin then
    perform private.require_company_verification_owner(verification_record.workspace_id);
  end if;
  if exists (
    select 1 from public.project_verification_events event
    where event.verification_id = verification_record.id and event.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'idempotent', true);
  end if;
  if verification_record.state not in ('ready_for_assignment', 'resubmitted')
    or not private.reviewer_user_is_eligible_for_workspace(requested_reviewer_user_id, verification_record.workspace_id)
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  prior_state := verification_record.state;
  insert into public.project_verification_reviews (
    verification_id, workspace_id, submission_version_id, rubric_version_id,
    reviewer_user_id, assigned_by_user_id, is_appeal_review
  ) values (
    verification_record.id, verification_record.workspace_id,
    verification_record.current_submission_version_id, verification_record.rubric_version_id,
    requested_reviewer_user_id, actor_id, false
  ) returning * into review_record;
  insert into public.project_workspace_members (
    workspace_id, organization_id, user_id, role, status, granted_by_user_id, review_material_granted
  ) values (
    verification_record.workspace_id, verification_record.organization_id,
    requested_reviewer_user_id, 'reviewer', 'active', actor_id, true
  ) on conflict (workspace_id, user_id, role) do update
    set status = 'active', removed_at = null, review_material_granted = true, updated_at = now();
  update public.project_verifications
    set state = case when prior_state = 'resubmitted' then 'final_review' else 'assigned' end,
        updated_at = now()
    where id = verification_record.id
    returning * into verification_record;
  insert into public.project_verification_events (
    verification_id, review_id, workspace_id, organization_id, actor_user_id,
    event_type, previous_state, next_state, idempotency_key
  ) values (
    verification_record.id, review_record.id, verification_record.workspace_id,
    verification_record.organization_id, actor_id, 'verification.assigned',
    prior_state, verification_record.state, requested_idempotency_key
  );
  return jsonb_build_object('review_id', review_record.id, 'state', verification_record.state);
end;
$$;

create or replace function public.decide_project_verification_review(
  requested_review_id uuid,
  requested_decision text,
  requested_decision_summary text,
  requested_actionable_next_steps text,
  requested_reviewer_attribution_mode public.verification_reviewer_attribution_mode,
  requested_observations jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  review_record public.project_verification_reviews;
  verification_record public.project_verifications;
  submission_record public.project_workspace_submissions;
  observation jsonb;
  expected_dimensions integer;
  created_observations integer := 0;
  next_state public.verification_state;
  proof_record public.verification_proofs;
  prior_state public.verification_state;
begin
  if requested_decision not in ('changes_requested', 'verified', 'not_verified')
    or jsonb_typeof(requested_observations) <> 'array'
    or jsonb_array_length(requested_observations) not between 1 and 8
    or char_length(trim(coalesce(requested_decision_summary, ''))) not between 20 and 1600
    or char_length(trim(coalesce(requested_actionable_next_steps, ''))) > 1600
    or (requested_decision = 'changes_requested' and char_length(trim(coalesce(requested_actionable_next_steps, ''))) < 20)
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into review_record from public.project_verification_reviews where id = requested_review_id for update;
  select * into verification_record from public.project_verifications where id = review_record.verification_id for update;
  if review_record.id is null
    or review_record.reviewer_user_id <> actor_id
    or review_record.state <> 'under_review'
    or not private.reviewer_user_is_eligible_for_workspace(actor_id, review_record.workspace_id)
    or verification_record.state not in ('under_review', 'appealed')
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if exists (
    select 1 from public.project_verification_events event
    where event.verification_id = verification_record.id and event.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'idempotent', true);
  end if;
  select count(*) into expected_dimensions
    from public.project_rubric_dimensions
    where rubric_version_id = review_record.rubric_version_id;
  if expected_dimensions <> jsonb_array_length(requested_observations) then raise exception 'VALIDATION_FAILED'; end if;
  for observation in select value from jsonb_array_elements(requested_observations) loop
    if jsonb_typeof(observation) <> 'object'
      or observation->>'rubric_dimension_id' !~ '^[0-9a-fA-F-]{36}$'
      or observation->>'selected_descriptor_level' not in ('not_demonstrated', 'emerging', 'working_in_context', 'independent_in_context', 'advanced_in_context')
      or char_length(trim(coalesce(observation->>'observation', ''))) not between 20 and 1400
      or char_length(coalesce(observation->>'shared_feedback', '')) > 1400
      or char_length(coalesce(observation->>'private_note', '')) > 1400
      or not exists (
        select 1 from public.project_rubric_dimensions dimension
        where dimension.id = (observation->>'rubric_dimension_id')::uuid
          and dimension.rubric_version_id = review_record.rubric_version_id
      )
    then raise exception 'VALIDATION_FAILED'; end if;
    insert into public.project_verification_observations (
      review_id, verification_id, rubric_dimension_id, selected_descriptor_level,
      observation, shared_feedback, private_note, feedback_visibility
    )
    select review_record.id, verification_record.id, dimension.id,
      (observation->>'selected_descriptor_level')::public.project_rubric_descriptor_level,
      trim(observation->>'observation'), trim(coalesce(observation->>'shared_feedback', '')),
      trim(coalesce(observation->>'private_note', '')), dimension.feedback_visibility
    from public.project_rubric_dimensions dimension
    where dimension.id = (observation->>'rubric_dimension_id')::uuid;
    created_observations := created_observations + 1;
  end loop;
  if created_observations <> expected_dimensions then raise exception 'VALIDATION_FAILED'; end if;
  prior_state := verification_record.state;
  next_state := requested_decision::public.verification_state;
  update public.project_verification_reviews
    set state = requested_decision::public.verification_review_state,
        reviewer_attribution_mode = requested_reviewer_attribution_mode,
        decision_summary = trim(requested_decision_summary),
        actionable_next_steps = trim(coalesce(requested_actionable_next_steps, '')),
        decided_at = now()
    where id = review_record.id
    returning * into review_record;
  select * into submission_record from public.project_workspace_submissions where id = verification_record.submission_id for update;
  update public.project_verifications
    set state = next_state,
        verified_at = case when next_state = 'verified' then now() else verified_at end,
        not_verified_at = case when next_state = 'not_verified' then now() else not_verified_at end,
        updated_at = now()
    where id = verification_record.id
    returning * into verification_record;
  if next_state = 'changes_requested' then
    update public.project_workspace_submissions set state = 'changes_requested', updated_at = now() where id = submission_record.id;
    update public.project_workspaces set state = 'active', updated_at = now() where id = verification_record.workspace_id;
  else
    update public.project_workspace_submissions
      set state = case when next_state = 'verified' then 'accepted' else 'rejected' end,
          updated_at = now()
      where id = submission_record.id;
    update public.project_workspaces set state = 'completed', updated_at = now() where id = verification_record.workspace_id;
  end if;
  if review_record.is_appeal_review then
    update public.project_verification_appeals
      set state = 'resolved', resolution_summary = trim(requested_decision_summary), resolved_at = now(), updated_at = now()
      where verification_id = verification_record.id and state = 'assigned';
  end if;
  if next_state = 'verified' then
    insert into public.verification_proofs (
      verification_id, talent_user_id, workspace_id, submission_version_id,
      rubric_version_id, reviewer_user_id, reviewer_attribution_mode, skill_keys, state
    )
    select verification_record.id, verification_record.talent_user_id,
      verification_record.workspace_id, review_record.submission_version_id,
      review_record.rubric_version_id, actor_id, requested_reviewer_attribution_mode,
      coalesce((
        select jsonb_agg(distinct skill_key)
        from public.project_rubric_dimensions dimension
        cross join lateral jsonb_array_elements_text(dimension.skill_keys) skill_key
        where dimension.rubric_version_id = review_record.rubric_version_id
      ), '[]'::jsonb),
      'private';
  end if;
  select * into proof_record from public.verification_proofs where verification_id = verification_record.id;
  insert into public.project_verification_events (
    verification_id, review_id, workspace_id, organization_id, actor_user_id,
    event_type, previous_state, next_state
  ) values (
    verification_record.id, review_record.id, verification_record.workspace_id,
    verification_record.organization_id, actor_id, 'verification.observations_recorded',
    prior_state, prior_state
  );
  insert into public.project_verification_events (
    verification_id, review_id, proof_id, workspace_id, organization_id, actor_user_id,
    event_type, previous_state, next_state, idempotency_key
  ) values (
    verification_record.id, review_record.id, proof_record.id,
    verification_record.workspace_id, verification_record.organization_id, actor_id,
    case next_state
      when 'changes_requested' then 'verification.changes_requested'
      when 'verified' then 'verification.verified'
      else 'verification.not_verified'
    end,
    prior_state, next_state, requested_idempotency_key
  );
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, event_type)
    values (verification_record.workspace_id, verification_record.organization_id, actor_id, 'workspace.verification_event');
  return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'proof_id', proof_record.id);
end;
$$;

create or replace function public.revoke_project_verification(
  requested_verification_id uuid,
  requested_reason public.verification_revocation_reason,
  requested_note text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  verification_record public.project_verifications;
  proof_record public.verification_proofs;
  prior_state public.verification_state;
begin
  if actor_id is null
    or not private.verification_actor_is_admin()
    or char_length(trim(coalesce(requested_note, ''))) not between 20 and 1600
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  if verification_record.id is not null and exists (
    select 1 from public.project_verification_events event
    where event.verification_id = verification_record.id and event.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'idempotent', true);
  end if;
  select * into proof_record from public.verification_proofs where verification_id = requested_verification_id for update;
  if verification_record.id is null or verification_record.state <> 'verified' or proof_record.id is null then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  prior_state := verification_record.state;
  update public.project_verifications set state = 'revoked', revoked_at = now(), updated_at = now() where id = verification_record.id;
  update public.verification_proofs set state = 'revoked', revoked_at = now(), updated_at = now() where id = proof_record.id;
  update public.talent_public_proofs set status = 'revoked', revoked_at = now(), updated_at = now()
    where verification_proof_id = proof_record.id and status = 'verified';
  insert into public.project_verification_events (
    verification_id, proof_id, workspace_id, organization_id, actor_user_id,
    event_type, previous_state, next_state, idempotency_key, metadata
  ) values (
    verification_record.id, proof_record.id, verification_record.workspace_id,
    verification_record.organization_id, actor_id, 'verification.revoked',
    prior_state, 'revoked', requested_idempotency_key,
    jsonb_build_object('reason', requested_reason, 'note', trim(requested_note))
  );
  return jsonb_build_object('verification_id', verification_record.id, 'state', 'revoked');
end;
$$;

create or replace function public.get_workspace_verification(requested_workspace_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  access_role public.project_workspace_member_role;
  verification_record public.project_verifications;
  is_admin boolean := public.has_active_platform_administrator_context();
begin
  access_role := public.project_workspace_access_role(requested_workspace_id);
  if access_role is null and not is_admin then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where workspace_id = requested_workspace_id;
  if verification_record.id is null then return null; end if;
  if access_role = 'reviewer' and not exists (
    select 1 from public.project_verification_reviews review
    where review.verification_id = verification_record.id and review.reviewer_user_id = actor_id
  ) and not is_admin then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'id', verification_record.id,
    'workspace_id', verification_record.workspace_id,
    'submission_id', verification_record.submission_id,
    'submission_version_id', verification_record.current_submission_version_id,
    'rubric_version_id', verification_record.rubric_version_id,
    'state', verification_record.state,
    'talent_user_id', verification_record.talent_user_id,
    'updated_at', verification_record.updated_at,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', review.id,
        'reviewer_user_id', case when is_admin or review.reviewer_user_id = actor_id then review.reviewer_user_id else null end,
        'state', review.state,
        'is_appeal_review', review.is_appeal_review,
        'assigned_at', review.assigned_at,
        'started_at', review.started_at,
        'decided_at', review.decided_at,
        'decision_summary', case when access_role in ('talent_participant', 'company_participant') or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) or is_admin then review.decision_summary else '' end,
        'actionable_next_steps', case when access_role in ('talent_participant', 'company_participant') or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) or is_admin then review.actionable_next_steps else '' end,
        'reviewer_attribution_mode', review.reviewer_attribution_mode,
        'observations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'rubric_dimension_id', observation.rubric_dimension_id,
            'selected_descriptor_level', observation.selected_descriptor_level,
            'observation', case
              when is_admin or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) then observation.observation
              when access_role = 'talent_participant' and observation.feedback_visibility = 'talent_and_company' then observation.observation
              when access_role = 'company_participant' and observation.feedback_visibility in ('talent_and_company', 'company_only') then observation.observation
              else ''
            end,
            'shared_feedback', case
              when is_admin or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) then observation.shared_feedback
              when access_role = 'talent_participant' and observation.feedback_visibility = 'talent_and_company' then observation.shared_feedback
              when access_role = 'company_participant' and observation.feedback_visibility in ('talent_and_company', 'company_only') then observation.shared_feedback
              else ''
            end,
            'private_note', case when is_admin or (access_role = 'reviewer' and review.reviewer_user_id = actor_id) then observation.private_note else '' end,
            'feedback_visibility', observation.feedback_visibility
          ) order by observation.created_at)
          from public.project_verification_observations observation
          where observation.review_id = review.id
        ), '[]'::jsonb)
      ) order by review.assigned_at asc)
      from public.project_verification_reviews review
      where review.verification_id = verification_record.id
        and (is_admin or access_role <> 'reviewer' or review.reviewer_user_id = actor_id)
    ), '[]'::jsonb),
    'appeal', (
      select jsonb_build_object(
        'id', appeal.id,
        'state', appeal.state,
        'reason', case when appeal.talent_user_id = actor_id or is_admin then appeal.reason else '' end,
        'assigned_reviewer_user_id', case when is_admin or appeal.assigned_reviewer_user_id = actor_id then appeal.assigned_reviewer_user_id else null end,
        'resolution_summary', case when appeal.talent_user_id = actor_id or is_admin or appeal.assigned_reviewer_user_id = actor_id then appeal.resolution_summary else '' end,
        'requested_at', appeal.requested_at
      ) from public.project_verification_appeals appeal where appeal.verification_id = verification_record.id
    ),
    'proof', (
      select jsonb_build_object(
        'id', proof.id, 'state', proof.state, 'skill_keys', proof.skill_keys,
        'verified_at', proof.verified_at, 'expires_at', proof.expires_at, 'revoked_at', proof.revoked_at
      ) from public.verification_proofs proof where proof.verification_id = verification_record.id
    )
  );
end;
$$;

create or replace function public.get_verification_reviewer_candidates(requested_verification_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare verification_record public.project_verifications;
begin
  select * into verification_record from public.project_verifications where id = requested_verification_id;
  if verification_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if not private.verification_actor_is_admin() then
    perform private.require_company_verification_owner(verification_record.workspace_id);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', application.user_id,
      'display_name', profile.display_name,
      'skill_keys', skills.skill_keys
    ) order by profile.display_name)
    from public.reviewer_applications application
    join public.reviewer_profiles profile on profile.application_id = application.id
    cross join lateral (
      select coalesce(jsonb_agg(skill.skill_key order by skill.skill_key), '[]'::jsonb) as skill_keys
      from public.reviewer_profile_skills skill
      where skill.application_id = application.id and skill.is_current
    ) skills
    where private.reviewer_user_is_eligible_for_workspace(application.user_id, verification_record.workspace_id)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.prepare_project_verification(uuid, uuid), public.assign_project_verification_reviewer(uuid, uuid, uuid), public.decide_project_verification_review(uuid, text, text, text, public.verification_reviewer_attribution_mode, jsonb, uuid), public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid), public.get_workspace_verification(uuid), public.get_verification_reviewer_candidates(uuid) from public, anon;
grant execute on function public.prepare_project_verification(uuid, uuid), public.assign_project_verification_reviewer(uuid, uuid, uuid), public.decide_project_verification_review(uuid, text, text, text, public.verification_reviewer_attribution_mode, jsonb, uuid), public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid), public.get_workspace_verification(uuid), public.get_verification_reviewer_candidates(uuid) to authenticated;
