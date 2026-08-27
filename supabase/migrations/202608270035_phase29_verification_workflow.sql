-- Phase 29 — Human-accountable verification workflow.
-- Owner: Reviews and Proof modules. Risk: self/conflicted review, client-forced outcome,
-- private-note disclosure, invalid proof publication, history loss, and unauthorized revocation.
-- Rollback: forward compensation only; revoke commands and hide routes while retaining restricted
-- verification, decision, appeal, proof, and audit records.

create type public.verification_state as enum (
  'not_eligible', 'ready_for_assignment', 'assigned', 'under_review',
  'changes_requested', 'resubmitted', 'final_review', 'verified',
  'not_verified', 'revoked', 'appealed'
);
create type public.verification_review_state as enum (
  'assigned', 'under_review', 'changes_requested', 'verified', 'not_verified', 'superseded'
);
create type public.verification_appeal_state as enum ('requested', 'assigned', 'resolved', 'withdrawn');
create type public.verification_reviewer_attribution_mode as enum ('display_name', 'withhold_name');
create type public.verification_proof_state as enum ('private', 'public', 'revoked');
create type public.verification_revocation_reason as enum ('fraud', 'incorrect_attribution', 'policy_breach', 'material_change');

create table public.project_verifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  submission_id uuid not null unique references public.project_workspace_submissions(id) on delete restrict,
  current_submission_version_id uuid not null references public.project_workspace_submission_versions(id) on delete restrict,
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  state public.verification_state not null default 'ready_for_assignment',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  not_verified_at timestamptz,
  revoked_at timestamptz,
  check ((state = 'verified') = (verified_at is not null)),
  check ((state = 'not_verified') = (not_verified_at is not null)),
  check ((state = 'revoked') = (revoked_at is not null))
);

create table public.project_verification_reviews (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.project_verifications(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  submission_version_id uuid not null references public.project_workspace_submission_versions(id) on delete restrict,
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict,
  state public.verification_review_state not null default 'assigned',
  is_appeal_review boolean not null default false,
  reviewer_attribution_mode public.verification_reviewer_attribution_mode not null default 'withhold_name',
  decision_summary text not null default '' check (char_length(decision_summary) <= 1600),
  actionable_next_steps text not null default '' check (char_length(actionable_next_steps) <= 1600),
  verification_expires_at timestamptz,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (verification_id, submission_version_id, reviewer_user_id, is_appeal_review),
  check ((state = 'under_review') = (started_at is not null)),
  check ((state in ('changes_requested', 'verified', 'not_verified')) = (decided_at is not null))
);

create table public.project_verification_observations (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.project_verification_reviews(id) on delete restrict,
  verification_id uuid not null references public.project_verifications(id) on delete restrict,
  rubric_dimension_id uuid not null references public.project_rubric_dimensions(id) on delete restrict,
  selected_descriptor_level public.project_rubric_descriptor_level not null,
  observation text not null check (char_length(observation) between 20 and 1400),
  shared_feedback text not null default '' check (char_length(shared_feedback) <= 1400),
  private_note text not null default '' check (char_length(private_note) <= 1400),
  feedback_visibility public.project_rubric_feedback_visibility not null,
  created_at timestamptz not null default now(),
  unique (review_id, rubric_dimension_id)
);

create table public.project_verification_appeals (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null unique references public.project_verifications(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  state public.verification_appeal_state not null default 'requested',
  reason text not null check (char_length(reason) between 30 and 1800),
  assigned_reviewer_user_id uuid references auth.users(id) on delete restrict,
  assigned_by_user_id uuid references auth.users(id) on delete restrict,
  resolution_summary text not null default '' check (char_length(resolution_summary) <= 1600),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'assigned') = (assigned_reviewer_user_id is not null and assigned_by_user_id is not null)),
  check ((state = 'resolved') = (resolved_at is not null))
);

create table public.verification_proofs (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null unique references public.project_verifications(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  submission_version_id uuid not null references public.project_workspace_submission_versions(id) on delete restrict,
  rubric_version_id uuid not null references public.project_rubric_versions(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_attribution_mode public.verification_reviewer_attribution_mode not null,
  skill_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(skill_keys) = 'array' and jsonb_array_length(skill_keys) > 0),
  state public.verification_proof_state not null default 'private',
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'revoked') = (revoked_at is not null))
);

create table public.project_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.project_verifications(id) on delete restrict,
  review_id uuid references public.project_verification_reviews(id) on delete restrict,
  appeal_id uuid references public.project_verification_appeals(id) on delete restrict,
  proof_id uuid references public.verification_proofs(id) on delete restrict,
  workspace_id uuid not null references public.project_workspaces(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'verification.prepared', 'verification.assigned', 'verification.review_started',
    'verification.observations_recorded', 'verification.changes_requested',
    'verification.verified', 'verification.not_verified', 'verification.appealed',
    'verification.appeal_assigned', 'verification.proof_published', 'verification.revoked'
  )),
  previous_state public.verification_state,
  next_state public.verification_state,
  idempotency_key uuid,
  occurred_at timestamptz not null default now(),
  unique (verification_id, idempotency_key),
  check ((previous_state is null) = (next_state is null))
);

alter table public.talent_public_proofs
  add column verification_id uuid references public.project_verifications(id) on delete restrict,
  add column verification_proof_id uuid references public.verification_proofs(id) on delete restrict,
  add column submission_version_id uuid references public.project_workspace_submission_versions(id) on delete restrict,
  add column rubric_version_id uuid references public.project_rubric_versions(id) on delete restrict,
  add column reviewer_user_id uuid references auth.users(id) on delete restrict;
create unique index talent_public_proofs_verification_proof_idx
  on public.talent_public_proofs(verification_proof_id) where verification_proof_id is not null;

alter table public.project_workspaces drop constraint if exists project_workspace_activity_event_type_check;
alter table public.project_workspace_activity add constraint project_workspace_activity_event_type_check check (event_type in (
  'workspace.created', 'workspace.state_changed', 'workspace.member_granted',
  'workspace.member_removed', 'workspace.member_reactivated', 'workspace.task_created',
  'workspace.task_changed', 'workspace.file_event', 'workspace.submission_event',
  'workspace.verification_event'
));

create index project_verifications_workspace_state_idx on public.project_verifications(workspace_id, state, updated_at desc);
create index project_verification_reviews_reviewer_state_idx on public.project_verification_reviews(reviewer_user_id, state, assigned_at desc);
create index project_verification_observations_review_idx on public.project_verification_observations(review_id);
create index project_verification_events_verification_occurred_idx on public.project_verification_events(verification_id, occurred_at asc);
create index verification_proofs_talent_state_idx on public.verification_proofs(talent_user_id, state, verified_at desc);

alter table public.project_verifications enable row level security;
alter table public.project_verification_reviews enable row level security;
alter table public.project_verification_observations enable row level security;
alter table public.project_verification_appeals enable row level security;
alter table public.verification_proofs enable row level security;
alter table public.project_verification_events enable row level security;

create or replace function private.verification_actor_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_platform_administrator_context()
$$;

create or replace function private.reviewer_user_is_eligible_for_workspace(
  target_reviewer_user_id uuid, requested_workspace_id uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.reviewer_applications application
    join public.reviewer_profiles profile on profile.application_id = application.id
    join public.project_workspaces workspace on workspace.id = requested_workspace_id
    join public.company_project_drafts project on project.id = workspace.project_id
    join public.role_capabilities capability on capability.user_id = application.user_id
    where application.user_id = target_reviewer_user_id
      and application.state = 'active'
      and application.current_policy_version = 'reviewer-conduct-v1'
      and application.current_policy_agreed_at is not null
      and application.conflict_declarations_confirmed_at is not null
      and 'reviewer' = any(capability.capabilities)
      and capability.reviewer_approved_at is not null
      and profile.availability_status in ('available', 'limited')
      and jsonb_array_length(project.required_skills) > 0
      and not exists (
        select 1 from jsonb_array_elements_text(project.required_skills) required_skill(skill_key)
        where not exists (
          select 1 from public.reviewer_profile_skills skill
          where skill.application_id = application.id and skill.is_current and skill.skill_key = required_skill.skill_key
        )
      )
      and not exists (
        select 1 from public.project_workspace_members member
        where member.workspace_id = workspace.id and member.user_id = target_reviewer_user_id
          and member.role = 'talent_participant' and member.status = 'active'
      )
      and not exists (
        select 1 from public.project_workspace_submissions submission
        where submission.workspace_id = workspace.id and submission.talent_user_id = target_reviewer_user_id
      )
      and not exists (
        select 1 from public.reviewer_conflict_declarations conflict
        where conflict.application_id = application.id and conflict.is_current
          and (conflict.scope = 'general' or conflict.organization_id = workspace.organization_id)
      )
      and (select count(*) from public.project_verification_reviews review
           join public.project_verifications verification on verification.id = review.verification_id
           where review.reviewer_user_id = target_reviewer_user_id
             and review.state in ('assigned','under_review')
             and verification.state not in ('verified','not_verified','revoked')) < profile.max_concurrent_reviews
  )
$$;

create or replace function private.require_company_verification_owner(requested_workspace_id uuid)
returns public.project_workspaces language plpgsql security definer set search_path = public as $$
declare result public.project_workspaces;
begin
  select workspace.* into result from public.project_workspaces workspace
  join public.active_contexts context on context.user_id = auth.uid()
  where workspace.id = requested_workspace_id
    and context.active_role = 'company_member'
    and context.active_organization_id = workspace.organization_id
    and public.has_organization_permission(workspace.organization_id, 'owner');
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function public.prepare_project_verification(
  requested_workspace_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); workspace_record public.project_workspaces; submission_record public.project_workspace_submissions;
  version_record public.project_workspace_submission_versions; verification_record public.project_verifications;
  rubric_version_id uuid; prior_state public.verification_state;
begin
  workspace_record := private.require_company_verification_owner(requested_workspace_id);
  select * into submission_record from public.project_workspace_submissions
  where workspace_id = workspace_record.id and state in ('submitted','resubmitted') for update;
  if submission_record.id is null then raise exception 'INVALID_STATE'; end if;
  select * into version_record from public.project_workspace_submission_versions
  where submission_id = submission_record.id and version_number = submission_record.current_version_number for update;
  if version_record.id is null or not version_record.ownership_confirmed or not version_record.attribution_confirmed
    or not exists (select 1 from public.project_workspace_submission_version_files file_link join public.project_workspace_file_versions file_version on file_version.id = file_link.file_version_id where file_link.submission_version_id = version_record.id and file_version.scan_state = 'clean') then raise exception 'VALIDATION_FAILED'; end if;
  rubric_version_id := private.lock_project_workspace_rubric(workspace_record.id, actor_id);
  select * into verification_record from public.project_verifications where workspace_id = workspace_record.id for update;
  if verification_record.id is null then
    insert into public.project_verifications (workspace_id, organization_id, submission_id, current_submission_version_id, rubric_version_id, talent_user_id, state, created_by_user_id)
    values (workspace_record.id, workspace_record.organization_id, submission_record.id, version_record.id, rubric_version_id, submission_record.talent_user_id, 'ready_for_assignment', actor_id)
    returning * into verification_record;
    prior_state := null;
  elsif verification_record.state = 'changes_requested' and submission_record.state = 'resubmitted' then
    prior_state := verification_record.state;
    update public.project_verifications set current_submission_version_id = version_record.id, state = 'resubmitted', updated_at = now()
    where id = verification_record.id returning * into verification_record;
    update public.project_verifications set state = 'ready_for_assignment', updated_at = now()
    where id = verification_record.id returning * into verification_record;
  else
    raise exception 'INVALID_STATE';
  end if;
  update public.project_workspace_submissions set state = 'under_review', updated_at = now() where id = submission_record.id;
  update public.project_workspaces set state = 'under_review', updated_at = now() where id = workspace_record.id;
  insert into public.project_verification_events (verification_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, workspace_record.id, workspace_record.organization_id, actor_id, 'verification.prepared', prior_state, verification_record.state, requested_idempotency_key);
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, event_type)
  values (workspace_record.id, workspace_record.organization_id, actor_id, 'workspace.verification_event');
  return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state);
end;
$$;

create or replace function public.assign_project_verification_reviewer(
  requested_verification_id uuid, requested_reviewer_user_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); verification_record public.project_verifications; review_record public.project_verification_reviews;
  prior_state public.verification_state; was_resubmission boolean;
begin
  if actor_id is null or not private.verification_actor_is_admin() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  if verification_record.id is null or verification_record.state <> 'ready_for_assignment'
    or not private.reviewer_user_is_eligible_for_workspace(requested_reviewer_user_id, verification_record.workspace_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  was_resubmission := exists (select 1 from public.project_verification_reviews review where review.verification_id = verification_record.id and review.state = 'changes_requested');
  prior_state := verification_record.state;
  insert into public.project_verification_reviews (verification_id, workspace_id, submission_version_id, rubric_version_id, reviewer_user_id, assigned_by_user_id, is_appeal_review)
  values (verification_record.id, verification_record.workspace_id, verification_record.current_submission_version_id, verification_record.rubric_version_id, requested_reviewer_user_id, actor_id, false)
  returning * into review_record;
  insert into public.project_workspace_members (workspace_id, organization_id, user_id, role, status, granted_by_user_id, review_material_granted)
  select verification_record.workspace_id, verification_record.organization_id, requested_reviewer_user_id, 'reviewer', 'active', actor_id, true
  on conflict (workspace_id, user_id, role) do update set status = 'active', removed_at = null, review_material_granted = true, updated_at = now();
  update public.project_verifications set state = case when was_resubmission then 'final_review' else 'assigned' end, updated_at = now()
  where id = verification_record.id returning * into verification_record;
  insert into public.project_verification_events (verification_id, review_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, review_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.assigned', prior_state, verification_record.state, requested_idempotency_key);
  return jsonb_build_object('review_id', review_record.id, 'state', verification_record.state);
end;
$$;

create or replace function public.begin_project_verification_review(requested_review_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); review_record public.project_verification_reviews; verification_record public.project_verifications; prior_state public.verification_state;
begin
  select * into review_record from public.project_verification_reviews where id = requested_review_id for update;
  select * into verification_record from public.project_verifications where id = review_record.verification_id for update;
  if review_record.id is null or review_record.reviewer_user_id <> actor_id or review_record.state <> 'assigned'
    or not private.reviewer_user_is_eligible_for_workspace(actor_id, review_record.workspace_id)
    or verification_record.state not in ('assigned','final_review','appealed') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  prior_state := verification_record.state;
  update public.project_verification_reviews set state = 'under_review', started_at = now() where id = review_record.id returning * into review_record;
  update public.project_verifications set state = case when review_record.is_appeal_review then 'appealed' else 'under_review' end, updated_at = now() where id = verification_record.id returning * into verification_record;
  insert into public.project_verification_events (verification_id, review_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state)
  values (verification_record.id, review_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.review_started', prior_state, verification_record.state);
  return jsonb_build_object('id', review_record.id, 'state', review_record.state);
end;
$$;

create or replace function public.decide_project_verification_review(
  requested_review_id uuid, requested_decision text, requested_decision_summary text,
  requested_actionable_next_steps text, requested_reviewer_attribution_mode public.verification_reviewer_attribution_mode,
  requested_observations jsonb, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); review_record public.project_verification_reviews; verification_record public.project_verifications;
  submission_record public.project_workspace_submissions; observation jsonb; expected_dimensions integer; created_observations integer := 0;
  next_state public.verification_state; proof_record public.verification_proofs; prior_state public.verification_state;
begin
  if requested_decision not in ('changes_requested','verified','not_verified')
    or jsonb_typeof(requested_observations) <> 'array' or jsonb_array_length(requested_observations) not between 1 and 8
    or char_length(trim(coalesce(requested_decision_summary,''))) not between 20 and 1600
    or char_length(trim(coalesce(requested_actionable_next_steps,''))) > 1600
    or (requested_decision = 'changes_requested' and char_length(trim(coalesce(requested_actionable_next_steps,''))) < 20) then raise exception 'VALIDATION_FAILED'; end if;
  select * into review_record from public.project_verification_reviews where id = requested_review_id for update;
  select * into verification_record from public.project_verifications where id = review_record.verification_id for update;
  if review_record.id is null or review_record.reviewer_user_id <> actor_id or review_record.state <> 'under_review'
    or not private.reviewer_user_is_eligible_for_workspace(actor_id, review_record.workspace_id)
    or verification_record.state not in ('under_review','appealed') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select count(*) into expected_dimensions from public.project_rubric_dimensions where rubric_version_id = review_record.rubric_version_id;
  if expected_dimensions <> jsonb_array_length(requested_observations) then raise exception 'VALIDATION_FAILED'; end if;
  for observation in select value from jsonb_array_elements(requested_observations) loop
    if jsonb_typeof(observation) <> 'object'
      or observation->>'rubric_dimension_id' !~ '^[0-9a-fA-F-]{36}$'
      or observation->>'selected_descriptor_level' not in ('not_demonstrated','emerging','working_in_context','independent_in_context','advanced_in_context')
      or char_length(trim(coalesce(observation->>'observation',''))) not between 20 and 1400
      or char_length(coalesce(observation->>'shared_feedback','')) > 1400
      or char_length(coalesce(observation->>'private_note','')) > 1400
      or not exists (select 1 from public.project_rubric_dimensions dimension where dimension.id = (observation->>'rubric_dimension_id')::uuid and dimension.rubric_version_id = review_record.rubric_version_id) then raise exception 'VALIDATION_FAILED'; end if;
    insert into public.project_verification_observations (review_id, verification_id, rubric_dimension_id, selected_descriptor_level, observation, shared_feedback, private_note, feedback_visibility)
    select review_record.id, verification_record.id, dimension.id,
      (observation->>'selected_descriptor_level')::public.project_rubric_descriptor_level,
      trim(observation->>'observation'), trim(coalesce(observation->>'shared_feedback','')),
      trim(coalesce(observation->>'private_note','')), dimension.feedback_visibility
    from public.project_rubric_dimensions dimension where dimension.id = (observation->>'rubric_dimension_id')::uuid;
    created_observations := created_observations + 1;
  end loop;
  if created_observations <> expected_dimensions then raise exception 'VALIDATION_FAILED'; end if;
  prior_state := verification_record.state;
  next_state := requested_decision::public.verification_state;
  update public.project_verification_reviews set state = requested_decision::public.verification_review_state,
    reviewer_attribution_mode = requested_reviewer_attribution_mode, decision_summary = trim(requested_decision_summary),
    actionable_next_steps = trim(coalesce(requested_actionable_next_steps,'')), decided_at = now()
  where id = review_record.id returning * into review_record;
  select * into submission_record from public.project_workspace_submissions where id = verification_record.submission_id for update;
  update public.project_verifications set state = next_state,
    verified_at = case when next_state = 'verified' then now() else null end,
    not_verified_at = case when next_state = 'not_verified' then now() else null end,
    updated_at = now() where id = verification_record.id returning * into verification_record;
  if next_state = 'changes_requested' then
    update public.project_workspace_submissions set state = 'changes_requested', updated_at = now() where id = submission_record.id;
    update public.project_workspaces set state = 'active', updated_at = now() where id = verification_record.workspace_id;
  else
    update public.project_workspace_submissions set state = case when next_state = 'verified' then 'accepted' else 'rejected' end, updated_at = now() where id = submission_record.id;
    update public.project_workspaces set state = 'completed', updated_at = now() where id = verification_record.workspace_id;
  end if;
  if next_state = 'verified' then
    insert into public.verification_proofs (verification_id, talent_user_id, workspace_id, submission_version_id, rubric_version_id, reviewer_user_id, reviewer_attribution_mode, skill_keys, state)
    select verification_record.id, verification_record.talent_user_id, verification_record.workspace_id,
      review_record.submission_version_id, review_record.rubric_version_id, actor_id, requested_reviewer_attribution_mode,
      coalesce((select jsonb_agg(distinct key) from public.project_rubric_dimensions dimension cross join lateral jsonb_array_elements_text(dimension.skill_keys) key where dimension.rubric_version_id = review_record.rubric_version_id), '[]'::jsonb), 'private'
    on conflict (verification_id) do update set updated_at = now()
    returning * into proof_record;
  end if;
  insert into public.project_verification_events (verification_id, review_id, proof_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, review_record.id, proof_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id,
    case next_state when 'changes_requested' then 'verification.changes_requested' when 'verified' then 'verification.verified' else 'verification.not_verified' end,
    prior_state, next_state, requested_idempotency_key);
  insert into public.project_workspace_activity (workspace_id, organization_id, actor_user_id, event_type)
  values (verification_record.workspace_id, verification_record.organization_id, actor_id, 'workspace.verification_event');
  return jsonb_build_object('verification_id', verification_record.id, 'state', verification_record.state, 'proof_id', proof_record.id);
end;
$$;

create or replace function public.appeal_project_verification(
  requested_verification_id uuid, requested_reason text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); verification_record public.project_verifications; appeal_record public.project_verification_appeals; prior_state public.verification_state;
begin
  if char_length(trim(coalesce(requested_reason,''))) not between 30 and 1800 then raise exception 'VALIDATION_FAILED'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  if verification_record.id is null or verification_record.talent_user_id <> actor_id or verification_record.state <> 'not_verified' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  prior_state := verification_record.state;
  insert into public.project_verification_appeals (verification_id, talent_user_id, reason)
  values (verification_record.id, actor_id, trim(requested_reason)) returning * into appeal_record;
  update public.project_verifications set state = 'appealed', updated_at = now() where id = verification_record.id returning * into verification_record;
  insert into public.project_verification_events (verification_id, appeal_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, appeal_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.appealed', prior_state, 'appealed', requested_idempotency_key);
  return jsonb_build_object('appeal_id', appeal_record.id, 'state', verification_record.state);
end;
$$;

create or replace function public.assign_project_verification_appeal(
  requested_verification_id uuid, requested_reviewer_user_id uuid, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); verification_record public.project_verifications; appeal_record public.project_verification_appeals; review_record public.project_verification_reviews; original_reviewer uuid;
begin
  if actor_id is null or not private.verification_actor_is_admin() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  select * into appeal_record from public.project_verification_appeals where verification_id = requested_verification_id for update;
  select reviewer_user_id into original_reviewer from public.project_verification_reviews where verification_id = requested_verification_id and is_appeal_review = false order by decided_at desc nulls last limit 1;
  if verification_record.id is null or verification_record.state <> 'appealed' or appeal_record.id is null or appeal_record.state <> 'requested'
    or requested_reviewer_user_id = original_reviewer or not private.reviewer_user_is_eligible_for_workspace(requested_reviewer_user_id, verification_record.workspace_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.project_verification_reviews (verification_id, workspace_id, submission_version_id, rubric_version_id, reviewer_user_id, assigned_by_user_id, is_appeal_review)
  values (verification_record.id, verification_record.workspace_id, verification_record.current_submission_version_id, verification_record.rubric_version_id, requested_reviewer_user_id, actor_id, true) returning * into review_record;
  insert into public.project_workspace_members (workspace_id, organization_id, user_id, role, status, granted_by_user_id, review_material_granted)
  select verification_record.workspace_id, verification_record.organization_id, requested_reviewer_user_id, 'reviewer', 'active', actor_id, true
  on conflict (workspace_id, user_id, role) do update set status = 'active', removed_at = null, review_material_granted = true, updated_at = now();
  update public.project_verification_appeals set state = 'assigned', assigned_reviewer_user_id = requested_reviewer_user_id, assigned_by_user_id = actor_id, updated_at = now() where id = appeal_record.id;
  insert into public.project_verification_events (verification_id, review_id, appeal_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, review_record.id, appeal_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.appeal_assigned', 'appealed', 'appealed', requested_idempotency_key);
  return jsonb_build_object('review_id', review_record.id, 'state', 'appealed');
end;
$$;

create or replace function public.publish_verified_proof(
  requested_verification_id uuid, requested_evidence_id uuid, requested_skill_key text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); verification_record public.project_verifications; proof_record public.verification_proofs; review_record public.project_verification_reviews; public_proof public.talent_public_proofs; attribution text := '';
begin
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  select * into proof_record from public.verification_proofs where verification_id = requested_verification_id for update;
  select * into review_record from public.project_verification_reviews where verification_id = requested_verification_id and state = 'verified' order by decided_at desc limit 1;
  if verification_record.id is null or verification_record.talent_user_id <> actor_id or verification_record.state <> 'verified'
    or proof_record.id is null or proof_record.state <> 'private' or requested_skill_key not in (select jsonb_array_elements_text(proof_record.skill_keys))
    or not exists (select 1 from public.work_evidence_publications evidence where evidence.evidence_id = requested_evidence_id and evidence.user_id = actor_id and evidence.state = 'published') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if proof_record.reviewer_attribution_mode = 'display_name' then
    select profile.display_name into attribution from public.reviewer_profiles profile where profile.user_id = proof_record.reviewer_user_id;
  end if;
  insert into public.talent_public_proofs (talent_user_id, evidence_id, skill_key, verification_method, reviewer_attribution, reviewer_attribution_is_public, status, verified_at, expires_at, verification_id, verification_proof_id, submission_version_id, rubric_version_id, reviewer_user_id)
  values (actor_id, requested_evidence_id, requested_skill_key, 'Qualified human review against a locked rubric version', coalesce(attribution,''), proof_record.reviewer_attribution_mode = 'display_name', 'verified', proof_record.verified_at, proof_record.expires_at, verification_record.id, proof_record.id, proof_record.submission_version_id, proof_record.rubric_version_id, proof_record.reviewer_user_id)
  returning * into public_proof;
  update public.verification_proofs set state = 'public', updated_at = now() where id = proof_record.id;
  insert into public.project_verification_events (verification_id, review_id, proof_id, workspace_id, organization_id, actor_user_id, event_type, idempotency_key)
  values (verification_record.id, review_record.id, proof_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.proof_published', requested_idempotency_key);
  return jsonb_build_object('proof_id', public_proof.id, 'state', 'public');
end;
$$;

create or replace function public.revoke_project_verification(
  requested_verification_id uuid, requested_reason public.verification_revocation_reason, requested_note text, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := auth.uid(); verification_record public.project_verifications; proof_record public.verification_proofs; prior_state public.verification_state;
begin
  if actor_id is null or not private.verification_actor_is_admin() or char_length(trim(coalesce(requested_note,''))) not between 20 and 1600 then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id for update;
  select * into proof_record from public.verification_proofs where verification_id = requested_verification_id for update;
  if verification_record.id is null or verification_record.state <> 'verified' or proof_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  prior_state := verification_record.state;
  update public.project_verifications set state = 'revoked', verified_at = null, revoked_at = now(), updated_at = now() where id = verification_record.id;
  update public.verification_proofs set state = 'revoked', revoked_at = now(), updated_at = now() where id = proof_record.id;
  update public.talent_public_proofs set status = 'revoked', revoked_at = now(), updated_at = now()
  where verification_proof_id = proof_record.id and status = 'verified';
  insert into public.project_verification_events (verification_id, proof_id, workspace_id, organization_id, actor_user_id, event_type, previous_state, next_state, idempotency_key)
  values (verification_record.id, proof_record.id, verification_record.workspace_id, verification_record.organization_id, actor_id, 'verification.revoked', prior_state, 'revoked', requested_idempotency_key);
  return jsonb_build_object('verification_id', verification_record.id, 'state', 'revoked');
end;
$$;

create or replace function public.get_workspace_verification(requested_workspace_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare actor_id uuid := auth.uid(); role public.project_workspace_member_role; verification_record public.project_verifications; is_admin boolean := public.has_active_platform_administrator_context();
begin
  role := public.project_workspace_access_role(requested_workspace_id);
  if role is null and not is_admin then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where workspace_id = requested_workspace_id;
  if verification_record.id is null then return null; end if;
  if role = 'reviewer' and not exists (select 1 from public.project_verification_reviews review where review.verification_id = verification_record.id and review.reviewer_user_id = actor_id) and not is_admin then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'id', verification_record.id, 'workspace_id', verification_record.workspace_id,
    'submission_id', verification_record.submission_id, 'submission_version_id', verification_record.current_submission_version_id,
    'rubric_version_id', verification_record.rubric_version_id, 'state', verification_record.state,
    'talent_user_id', verification_record.talent_user_id, 'updated_at', verification_record.updated_at,
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
      'id', review.id, 'reviewer_user_id', case when is_admin or review.reviewer_user_id = actor_id then review.reviewer_user_id else null end,
      'state', review.state, 'is_appeal_review', review.is_appeal_review, 'assigned_at', review.assigned_at, 'started_at', review.started_at,
      'decided_at', review.decided_at, 'decision_summary', case when role = 'reviewer' and review.reviewer_user_id = actor_id or role in ('talent_participant','company_participant') or is_admin then review.decision_summary else '' end,
      'actionable_next_steps', case when role = 'talent_participant' or role = 'company_participant' or (role = 'reviewer' and review.reviewer_user_id = actor_id) or is_admin then review.actionable_next_steps else '' end,
      'reviewer_attribution_mode', review.reviewer_attribution_mode,
      'observations', coalesce((select jsonb_agg(jsonb_build_object(
        'rubric_dimension_id', observation.rubric_dimension_id, 'selected_descriptor_level', observation.selected_descriptor_level,
        'observation', observation.observation,
        'shared_feedback', case when observation.feedback_visibility = 'talent_and_company' or role = 'company_participant' or (role = 'reviewer' and review.reviewer_user_id = actor_id) or is_admin then observation.shared_feedback else '' end,
        'private_note', case when (role = 'reviewer' and review.reviewer_user_id = actor_id) or is_admin then observation.private_note else '' end,
        'feedback_visibility', observation.feedback_visibility
      ) order by observation.created_at) from public.project_verification_observations observation where observation.review_id = review.id), '[]'::jsonb)
    ) order by review.assigned_at asc) from public.project_verification_reviews review where review.verification_id = verification_record.id), '[]'::jsonb),
    'appeal', (select jsonb_build_object('id', appeal.id, 'state', appeal.state, 'reason', case when appeal.talent_user_id = actor_id or is_admin then appeal.reason else '' end, 'assigned_reviewer_user_id', case when is_admin or appeal.assigned_reviewer_user_id = actor_id then appeal.assigned_reviewer_user_id else null end, 'resolution_summary', appeal.resolution_summary, 'requested_at', appeal.requested_at) from public.project_verification_appeals appeal where appeal.verification_id = verification_record.id),
    'proof', (select jsonb_build_object('id', proof.id, 'state', proof.state, 'skill_keys', proof.skill_keys, 'verified_at', proof.verified_at, 'expires_at', proof.expires_at, 'revoked_at', proof.revoked_at) from public.verification_proofs proof where proof.verification_id = verification_record.id)
  );
end;
$$;

create or replace function public.get_admin_verification_queue()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when public.has_active_platform_administrator_context() then coalesce(jsonb_agg(jsonb_build_object(
    'id', verification.id, 'workspace_id', verification.workspace_id, 'state', verification.state,
    'submission_version_id', verification.current_submission_version_id, 'updated_at', verification.updated_at,
    'appeal_state', appeal.state, 'can_revoke', verification.state = 'verified'
  ) order by verification.updated_at desc), '[]'::jsonb) else '[]'::jsonb end
  from public.project_verifications verification left join public.project_verification_appeals appeal on appeal.verification_id = verification.id
$$;

create or replace function public.get_verification_reviewer_candidates(requested_verification_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare verification_record public.project_verifications;
begin
  if not private.verification_actor_is_admin() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into verification_record from public.project_verifications where id = requested_verification_id;
  if verification_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', application.user_id, 'display_name', profile.display_name, 'skill_keys', skills.skill_keys) order by profile.display_name)
    from public.reviewer_applications application
    join public.reviewer_profiles profile on profile.application_id = application.id
    cross join lateral (select coalesce(jsonb_agg(skill.skill_key order by skill.skill_key), '[]'::jsonb) skill_keys from public.reviewer_profile_skills skill where skill.application_id = application.id and skill.is_current) skills
    where private.reviewer_user_is_eligible_for_workspace(application.user_id, verification_record.workspace_id)
  ), '[]'::jsonb);
end;
$$;

revoke all on table public.project_verifications, public.project_verification_reviews, public.project_verification_observations, public.project_verification_appeals, public.verification_proofs, public.project_verification_events from anon, authenticated;
revoke all on function private.verification_actor_is_admin(), private.reviewer_user_is_eligible_for_workspace(uuid, uuid), private.require_company_verification_owner(uuid) from public, anon, authenticated;
revoke all on function public.prepare_project_verification(uuid, uuid), public.assign_project_verification_reviewer(uuid, uuid, uuid), public.begin_project_verification_review(uuid), public.decide_project_verification_review(uuid, text, text, text, public.verification_reviewer_attribution_mode, jsonb, uuid), public.appeal_project_verification(uuid, text, uuid), public.assign_project_verification_appeal(uuid, uuid, uuid), public.publish_verified_proof(uuid, uuid, text, uuid), public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid), public.get_workspace_verification(uuid), public.get_admin_verification_queue(), public.get_verification_reviewer_candidates(uuid) from public, anon;
grant execute on function public.prepare_project_verification(uuid, uuid), public.assign_project_verification_reviewer(uuid, uuid, uuid), public.begin_project_verification_review(uuid), public.decide_project_verification_review(uuid, text, text, text, public.verification_reviewer_attribution_mode, jsonb, uuid), public.appeal_project_verification(uuid, text, uuid), public.assign_project_verification_appeal(uuid, uuid, uuid), public.publish_verified_proof(uuid, uuid, text, uuid), public.revoke_project_verification(uuid, public.verification_revocation_reason, text, uuid), public.get_workspace_verification(uuid), public.get_admin_verification_queue(), public.get_verification_reviewer_candidates(uuid) to authenticated;
