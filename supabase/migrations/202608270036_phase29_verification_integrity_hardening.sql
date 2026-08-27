-- Phase 29 forward integrity correction.
-- Corrects reviewer eligibility to reuse the canonical active-context/capacity rules and
-- ensures historical verification timestamps survive final transitions and revocation.
-- Rollback: forward compensation only; this migration deliberately retains audit evidence.

alter table public.project_verifications
  drop constraint project_verifications_check,
  drop constraint project_verifications_check1,
  drop constraint project_verifications_check2,
  add constraint project_verifications_verified_timestamp_check
    check (state <> 'verified' or verified_at is not null),
  add constraint project_verifications_not_verified_timestamp_check
    check (state <> 'not_verified' or not_verified_at is not null),
  add constraint project_verifications_revoked_timestamp_check
    check (state <> 'revoked' or revoked_at is not null);

alter table public.project_verification_reviews
  drop constraint project_verification_reviews_check,
  drop constraint project_verification_reviews_check1,
  add constraint project_verification_reviews_started_timestamp_check
    check (state <> 'under_review' or started_at is not null),
  add constraint project_verification_reviews_decided_timestamp_check
    check (state not in ('changes_requested', 'verified', 'not_verified') or decided_at is not null);

alter table public.verification_proofs
  drop constraint verification_proofs_check,
  add constraint verification_proofs_revoked_timestamp_check
    check (state <> 'revoked' or revoked_at is not null);

create or replace function private.reviewer_user_is_eligible_for_workspace(
  target_reviewer_user_id uuid,
  requested_workspace_id uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.reviewer_applications application
    join public.reviewer_profiles profile on profile.application_id = application.id
    join public.project_workspaces workspace on workspace.id = requested_workspace_id
    join public.company_project_drafts project on project.id = workspace.project_id
    join public.active_contexts context on context.user_id = application.user_id
    join public.role_capabilities capability on capability.user_id = application.user_id
    where application.user_id = target_reviewer_user_id
      and application.state = 'active'
      and application.current_policy_version = 'reviewer-conduct-v1'
      and application.current_policy_agreed_at is not null
      and application.conflict_declarations_confirmed_at is not null
      and context.active_role = 'reviewer'
      and context.active_organization_id is null
      and 'reviewer' = any(capability.capabilities)
      and capability.reviewer_approved_at is not null
      and profile.availability_status in ('available', 'limited')
      and jsonb_array_length(project.required_skills) > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(project.required_skills) required_skill(skill_key)
        where not exists (
          select 1
          from public.reviewer_profile_skills skill
          where skill.application_id = application.id
            and skill.is_current
            and skill.skill_key = required_skill.skill_key
        )
      )
      and not exists (
        select 1
        from public.project_workspace_members member
        where member.workspace_id = workspace.id
          and member.user_id = application.user_id
          and member.role = 'talent_participant'
          and member.status = 'active'
      )
      and not exists (
        select 1
        from public.project_workspace_submissions submission
        where submission.workspace_id = workspace.id
          and submission.talent_user_id = application.user_id
      )
      and not exists (
        select 1
        from public.reviewer_conflict_declarations conflict
        where conflict.application_id = application.id
          and conflict.is_current
          and (conflict.scope = 'general' or conflict.organization_id = workspace.organization_id)
      )
      and (
        exists (
          select 1
          from public.project_workspace_members existing_member
          where existing_member.workspace_id = workspace.id
            and existing_member.user_id = application.user_id
            and existing_member.role = 'reviewer'
            and existing_member.status = 'active'
            and existing_member.review_material_granted = true
        )
        or (
          select count(*)
          from public.project_workspace_members active_assignment
          join public.project_workspaces assigned_workspace on assigned_workspace.id = active_assignment.workspace_id
          where active_assignment.user_id = application.user_id
            and active_assignment.role = 'reviewer'
            and active_assignment.status = 'active'
            and active_assignment.review_material_granted = true
            and assigned_workspace.state not in ('completed', 'closed')
        ) < profile.max_concurrent_reviews
      )
  )
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
  select * into proof_record from public.verification_proofs where verification_id = requested_verification_id for update;
  if verification_record.id is null or verification_record.state <> 'verified' or proof_record.id is null then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  prior_state := verification_record.state;
  update public.project_verifications
    set state = 'revoked', revoked_at = now(), updated_at = now()
    where id = verification_record.id;
  update public.verification_proofs
    set state = 'revoked', revoked_at = now(), updated_at = now()
    where id = proof_record.id;
  update public.talent_public_proofs
    set status = 'revoked', revoked_at = now(), updated_at = now()
    where verification_proof_id = proof_record.id and status = 'verified';
  insert into public.project_verification_events (
    verification_id, proof_id, workspace_id, organization_id, actor_user_id,
    event_type, previous_state, next_state, idempotency_key
  ) values (
    verification_record.id, proof_record.id, verification_record.workspace_id,
    verification_record.organization_id, actor_id, 'verification.revoked',
    prior_state, 'revoked', requested_idempotency_key
  );
  return jsonb_build_object('verification_id', verification_record.id, 'state', 'revoked', 'reason', requested_reason);
end;
$$;

revoke all on function private.reviewer_user_is_eligible_for_workspace(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid) from public, anon;
grant execute on function public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid) to authenticated;
