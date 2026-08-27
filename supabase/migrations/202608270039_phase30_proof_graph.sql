-- Phase 30 — Explainable Proof Graph and contextual reputation.
-- Owner: Proof module. Risk: unverified self-claims, private review disclosure,
-- silent reputation rewrites, organization overreach, and opaque scoring.
-- Rollback: forward compensation only; disable readers and withdraw public consent
-- while retaining append-only relations and reputation events for authorized audit.

create type public.proof_graph_relation_type as enum (
  'person_demonstrated_skill',
  'submission_belongs_to_project',
  'review_evaluates_submission',
  'proof_verifies_skill',
  'company_outcome_context',
  'endorsement_context'
);

create type public.proof_graph_visibility as enum ('private', 'public', 'restricted');
create type public.proof_graph_verification_state as enum ('human_verified', 'contextual', 'revoked');
create type public.proof_reputation_event_type as enum (
  'proof.verified',
  'proof.published',
  'proof.revoked',
  'company_outcome.proposed',
  'company_outcome.confirmed',
  'company_outcome.withdrawn',
  'endorsement.proposed',
  'endorsement.confirmed',
  'endorsement.withdrawn',
  'reputation.correction'
);
create type public.proof_reputation_event_visibility as enum ('private', 'public', 'restricted');
create type public.proof_company_outcome_type as enum (
  'completed_on_time',
  'revision_accepted',
  'outcome_confirmed'
);
create type public.proof_relationship_state as enum ('proposed', 'consented', 'withdrawn');

create table public.proof_graph_relations (
  id uuid primary key default gen_random_uuid(),
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  public_proof_id uuid references public.talent_public_proofs(id) on delete restrict,
  verification_proof_id uuid references public.verification_proofs(id) on delete restrict,
  evidence_id uuid references public.work_evidence_items(id) on delete restrict,
  submission_version_id uuid references public.project_workspace_submission_versions(id) on delete restrict,
  project_id uuid references public.company_project_drafts(id) on delete restrict,
  review_id uuid references public.project_verification_reviews(id) on delete restrict,
  relation_type public.proof_graph_relation_type not null,
  skill_key text check (skill_key is null or skill_key ~ '^[a-z0-9-]{1,80}$'),
  verification_state public.proof_graph_verification_state not null,
  visibility public.proof_graph_visibility not null default 'private',
  source_event_id uuid not null,
  source_event_type text not null check (char_length(source_event_type) between 3 and 120),
  created_at timestamptz not null default now(),
  check (
    public_proof_id is not null
    or verification_proof_id is not null
    or evidence_id is not null
    or submission_version_id is not null
    or review_id is not null
  )
);

create unique index proof_graph_relations_proof_relation_skill_idx
  on public.proof_graph_relations(public_proof_id, relation_type, skill_key)
  where public_proof_id is not null and skill_key is not null;
create unique index proof_graph_relations_proof_relation_idx
  on public.proof_graph_relations(public_proof_id, relation_type)
  where public_proof_id is not null and skill_key is null;
create index proof_graph_relations_talent_visibility_idx
  on public.proof_graph_relations(talent_user_id, visibility, created_at desc);
create index proof_graph_relations_verification_proof_idx
  on public.proof_graph_relations(verification_proof_id);

create table public.proof_reputation_events (
  id uuid primary key default gen_random_uuid(),
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  public_proof_id uuid references public.talent_public_proofs(id) on delete restrict,
  verification_proof_id uuid references public.verification_proofs(id) on delete restrict,
  graph_relation_id uuid references public.proof_graph_relations(id) on delete restrict,
  source_event_id uuid not null,
  source_event_type text not null check (char_length(source_event_type) between 3 and 120),
  event_type public.proof_reputation_event_type not null,
  visibility public.proof_reputation_event_visibility not null default 'private',
  event_summary text not null default '' check (char_length(event_summary) <= 480),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  corrected_event_id uuid references public.proof_reputation_events(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_event_id, event_type)
);

create index proof_reputation_events_talent_visibility_occurred_idx
  on public.proof_reputation_events(talent_user_id, visibility, occurred_at desc);
create index proof_reputation_events_proof_occurred_idx
  on public.proof_reputation_events(public_proof_id, occurred_at desc);

create table public.proof_company_outcomes (
  id uuid primary key default gen_random_uuid(),
  public_proof_id uuid not null references public.talent_public_proofs(id) on delete restrict,
  verification_proof_id uuid not null references public.verification_proofs(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  proposed_by_user_id uuid not null references auth.users(id) on delete restrict,
  outcome_type public.proof_company_outcome_type not null,
  context_summary text not null check (char_length(trim(context_summary)) between 20 and 600),
  state public.proof_relationship_state not null default 'proposed',
  proposed_at timestamptz not null default now(),
  consented_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (state = 'proposed' and consented_at is null and withdrawn_at is null)
    or (state = 'consented' and consented_at is not null and withdrawn_at is null)
    or (state = 'withdrawn' and withdrawn_at is not null)
  )
);

create unique index proof_company_outcomes_active_unique_idx
  on public.proof_company_outcomes(public_proof_id, organization_id, outcome_type)
  where state in ('proposed', 'consented');
create index proof_company_outcomes_talent_state_idx
  on public.proof_company_outcomes(talent_user_id, state, proposed_at desc);

create table public.proof_endorsements (
  id uuid primary key default gen_random_uuid(),
  public_proof_id uuid not null references public.talent_public_proofs(id) on delete restrict,
  verification_proof_id uuid not null references public.verification_proofs(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  endorsed_by_user_id uuid not null references auth.users(id) on delete restrict,
  skill_key text not null check (skill_key ~ '^[a-z0-9-]{1,80}$'),
  endorsement_text text not null check (char_length(trim(endorsement_text)) between 20 and 600),
  state public.proof_relationship_state not null default 'proposed',
  proposed_at timestamptz not null default now(),
  consented_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (state = 'proposed' and consented_at is null and withdrawn_at is null)
    or (state = 'consented' and consented_at is not null and withdrawn_at is null)
    or (state = 'withdrawn' and withdrawn_at is not null)
  )
);

create unique index proof_endorsements_active_unique_idx
  on public.proof_endorsements(public_proof_id, organization_id, skill_key)
  where state in ('proposed', 'consented');
create index proof_endorsements_talent_state_idx
  on public.proof_endorsements(talent_user_id, state, proposed_at desc);

alter table public.proof_graph_relations enable row level security;
alter table public.proof_reputation_events enable row level security;
alter table public.proof_company_outcomes enable row level security;
alter table public.proof_endorsements enable row level security;

create or replace function private.append_proof_reputation_event(
  target_talent_user_id uuid,
  target_organization_id uuid,
  target_public_proof_id uuid,
  target_verification_proof_id uuid,
  target_relation_id uuid,
  target_source_event_id uuid,
  target_source_event_type text,
  target_event_type public.proof_reputation_event_type,
  target_visibility public.proof_reputation_event_visibility,
  target_summary text,
  target_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare event_id uuid;
begin
  if target_talent_user_id is null
    or target_source_event_id is null
    or char_length(trim(coalesce(target_source_event_type, ''))) not between 3 and 120
    or char_length(trim(coalesce(target_summary, ''))) > 480
    or jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object'
  then
    raise exception 'VALIDATION_FAILED';
  end if;
  insert into public.proof_reputation_events (
    talent_user_id, organization_id, public_proof_id, verification_proof_id,
    graph_relation_id, source_event_id, source_event_type, event_type,
    visibility, event_summary, metadata
  ) values (
    target_talent_user_id, target_organization_id, target_public_proof_id,
    target_verification_proof_id, target_relation_id, target_source_event_id,
    trim(target_source_event_type), target_event_type, target_visibility,
    trim(coalesce(target_summary, '')), target_metadata
  ) on conflict (source_event_id, event_type) do nothing
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function private.require_active_proof_graph_talent()
returns uuid
language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from public.active_contexts context
    where context.user_id = actor_id
      and context.active_role = 'talent'
      and context.active_organization_id is null
  ) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return actor_id;
end;
$$;

create or replace function private.require_proof_graph_company_owner(
  requested_public_proof_id uuid
) returns public.talent_public_proofs
language plpgsql security definer set search_path = public as $$
declare result public.talent_public_proofs;
begin
  select proof.* into result
  from public.talent_public_proofs proof
  join public.project_verifications verification on verification.id = proof.verification_id
  join public.active_contexts context on context.user_id = auth.uid()
  where proof.id = requested_public_proof_id
    and proof.status = 'verified'
    and proof.revoked_at is null
    and proof.verification_proof_id is not null
    and context.active_role = 'company_member'
    and context.active_organization_id = verification.organization_id
    and public.has_organization_permission(verification.organization_id, 'owner');
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.assert_public_proof_chain(
  requested_public_proof_id uuid
) returns public.talent_public_proofs
language plpgsql security definer set search_path = public as $$
declare result public.talent_public_proofs;
begin
  select proof.* into result
  from public.talent_public_proofs proof
  join public.project_verifications verification on verification.id = proof.verification_id
  join public.verification_proofs verification_proof on verification_proof.id = proof.verification_proof_id
  join public.project_verification_reviews review on review.verification_id = verification.id
    and review.id = (
      select latest_review.id from public.project_verification_reviews latest_review
      where latest_review.verification_id = verification.id
        and latest_review.state = 'verified'
      order by latest_review.decided_at desc nulls last, latest_review.id desc
      limit 1
    )
  join public.work_evidence_publications evidence on evidence.evidence_id = proof.evidence_id
    and evidence.user_id = proof.talent_user_id
    and evidence.state = 'published'
  where proof.id = requested_public_proof_id
    and proof.status = 'verified'
    and proof.revoked_at is null
    and verification.state = 'verified'
    and verification.current_submission_version_id = proof.submission_version_id
    and verification.rubric_version_id = proof.rubric_version_id
    and verification_proof.state = 'public'
    and verification_proof.talent_user_id = proof.talent_user_id
    and verification_proof.submission_version_id = proof.submission_version_id
    and verification_proof.rubric_version_id = proof.rubric_version_id
    and proof.skill_key = any (array(select jsonb_array_elements_text(verification_proof.skill_keys)));
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.materialize_public_proof_graph()
returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  proof_record public.talent_public_proofs;
  verification_record public.project_verifications;
  review_record public.project_verification_reviews;
  workspace_record public.project_workspaces;
  source_verification_event_id uuid;
  source_public_event_id uuid;
  relation_id uuid;
begin
  if tg_op = 'INSERT' and new.status = 'verified' and new.verification_id is not null then
    select proof.* into proof_record from public.talent_public_proofs proof where proof.id = new.id;
    select verification.* into verification_record from public.project_verifications verification where verification.id = proof_record.verification_id;
    select review.* into review_record from public.project_verification_reviews review
      where review.verification_id = proof_record.verification_id and review.state = 'verified'
      order by review.decided_at desc nulls last, review.id desc limit 1;
    select workspace.* into workspace_record from public.project_workspaces workspace where workspace.id = verification_record.workspace_id;
    select event.id into source_verification_event_id from public.project_verification_events event
      where event.verification_id = proof_record.verification_id and event.event_type = 'verification.verified'
      order by event.occurred_at desc, event.id desc limit 1;
    select event.id into source_public_event_id from public.talent_public_proof_events event
      where event.proof_id = proof_record.id and event.event_type = 'proof.verified'
      order by event.occurred_at desc, event.id desc limit 1;
    if verification_record.id is null or review_record.id is null or workspace_record.id is null
      or source_verification_event_id is null or source_public_event_id is null
    then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;

    insert into public.proof_graph_relations (
      talent_user_id, organization_id, public_proof_id, verification_proof_id,
      evidence_id, submission_version_id, project_id, review_id, relation_type,
      skill_key, verification_state, visibility, source_event_id, source_event_type
    ) values (
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, proof_record.evidence_id,
      proof_record.submission_version_id, workspace_record.project_id, review_record.id,
      'person_demonstrated_skill', proof_record.skill_key, 'human_verified', 'public',
      source_verification_event_id, 'verification.verified'
    ), (
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, proof_record.evidence_id,
      proof_record.submission_version_id, workspace_record.project_id, review_record.id,
      'submission_belongs_to_project', null, 'human_verified', 'public',
      source_verification_event_id, 'verification.verified'
    ), (
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, proof_record.evidence_id,
      proof_record.submission_version_id, workspace_record.project_id, review_record.id,
      'review_evaluates_submission', null, 'human_verified', 'public',
      source_verification_event_id, 'verification.verified'
    ), (
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, proof_record.evidence_id,
      proof_record.submission_version_id, workspace_record.project_id, review_record.id,
      'proof_verifies_skill', proof_record.skill_key, 'human_verified', 'public',
      source_verification_event_id, 'verification.verified'
    ) on conflict do nothing;

    select relation.id into relation_id from public.proof_graph_relations relation
      where relation.public_proof_id = proof_record.id
        and relation.relation_type = 'proof_verifies_skill'
        and relation.skill_key = proof_record.skill_key;
    perform private.append_proof_reputation_event(
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, relation_id, source_verification_event_id,
      'verification.verified', 'proof.verified', 'public',
      'A qualified human reviewer verified this skill against a locked rubric and exact submission version.',
      jsonb_build_object('skill_key', proof_record.skill_key)
    );
    perform private.append_proof_reputation_event(
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, relation_id, source_public_event_id,
      'proof.verified', 'proof.published', 'public',
      'The Talent chose to make this verified Proof public.',
      jsonb_build_object('skill_key', proof_record.skill_key)
    );
  elsif tg_op = 'UPDATE' and old.status = 'verified' and new.status = 'revoked'
    and new.verification_id is not null
  then
    select proof.* into proof_record from public.talent_public_proofs proof where proof.id = new.id;
    select verification.* into verification_record from public.project_verifications verification where verification.id = proof_record.verification_id;
    select event.id into source_public_event_id from public.talent_public_proof_events event
      where event.proof_id = proof_record.id and event.event_type = 'proof.revoked'
      order by event.occurred_at desc, event.id desc limit 1;
    if verification_record.id is null or source_public_event_id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    perform private.append_proof_reputation_event(
      proof_record.talent_user_id, verification_record.organization_id, proof_record.id,
      proof_record.verification_proof_id, null, source_public_event_id,
      'proof.revoked', 'proof.revoked', 'restricted',
      'A previously public Proof was revoked. Restricted audit history is retained.',
      '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists zz_materialize_public_proof_graph on public.talent_public_proofs;
create trigger zz_materialize_public_proof_graph
after insert or update of status on public.talent_public_proofs
for each row execute function private.materialize_public_proof_graph();

create or replace function public.propose_company_proof_outcome(
  requested_public_proof_id uuid,
  requested_outcome_type public.proof_company_outcome_type,
  requested_context_summary text,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  proof_record public.talent_public_proofs;
  verification_record public.project_verifications;
  outcome_record public.proof_company_outcomes;
  source_event_id uuid;
begin
  if actor_id is null or requested_idempotency_key is null
    or char_length(trim(coalesce(requested_context_summary, ''))) not between 20 and 600
  then raise exception 'VALIDATION_FAILED'; end if;
  proof_record := private.require_proof_graph_company_owner(requested_public_proof_id);
  select * into verification_record from public.project_verifications where id = proof_record.verification_id;
  select event.id into source_event_id from public.project_verification_events event
    where event.verification_id = verification_record.id and event.event_type = 'verification.verified'
    order by event.occurred_at desc, event.id desc limit 1;
  if source_event_id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.proof_company_outcomes (
    public_proof_id, verification_proof_id, talent_user_id, organization_id,
    proposed_by_user_id, outcome_type, context_summary
  ) values (
    proof_record.id, proof_record.verification_proof_id, proof_record.talent_user_id,
    verification_record.organization_id, actor_id, requested_outcome_type,
    trim(requested_context_summary)
  ) on conflict (public_proof_id, organization_id, outcome_type)
    where state in ('proposed', 'consented')
    do nothing
  returning * into outcome_record;
  if outcome_record.id is null then raise exception 'CONFLICT'; end if;
  perform private.append_proof_reputation_event(
    outcome_record.talent_user_id, outcome_record.organization_id,
    outcome_record.public_proof_id, outcome_record.verification_proof_id, null,
    outcome_record.id, 'company_outcome.proposed', 'company_outcome.proposed', 'private',
    'A company submitted an outcome context for the Talent to review before it becomes public.',
    jsonb_build_object('outcome_type', outcome_record.outcome_type, 'idempotency_key', requested_idempotency_key)
  );
  return jsonb_build_object('outcome_id', outcome_record.id, 'state', outcome_record.state);
end;
$$;

create or replace function public.consent_company_proof_outcome(
  requested_outcome_id uuid,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := private.require_active_proof_graph_talent();
  outcome_record public.proof_company_outcomes;
  source_event_id uuid;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into outcome_record from public.proof_company_outcomes
    where id = requested_outcome_id and talent_user_id = actor_id for update;
  if outcome_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if outcome_record.state = 'consented' then
    return jsonb_build_object('outcome_id', outcome_record.id, 'state', outcome_record.state, 'idempotent', true);
  end if;
  if outcome_record.state <> 'proposed' then raise exception 'INVALID_STATE'; end if;
  perform private.assert_public_proof_chain(outcome_record.public_proof_id);
  update public.proof_company_outcomes
    set state = 'consented', consented_at = now(), updated_at = now()
    where id = outcome_record.id returning * into outcome_record;
  source_event_id := outcome_record.id;
  perform private.append_proof_reputation_event(
    actor_id, outcome_record.organization_id, outcome_record.public_proof_id,
    outcome_record.verification_proof_id, null, source_event_id,
    'company_outcome.consent', 'company_outcome.confirmed', 'public',
    'The Talent consented to this company outcome context on a verified Proof.',
    jsonb_build_object('outcome_type', outcome_record.outcome_type, 'idempotency_key', requested_idempotency_key)
  );
  insert into public.proof_graph_relations (
    talent_user_id, organization_id, public_proof_id, verification_proof_id,
    relation_type, verification_state, visibility, source_event_id, source_event_type
  ) values (
    actor_id, outcome_record.organization_id, outcome_record.public_proof_id,
    outcome_record.verification_proof_id, 'company_outcome_context', 'contextual',
    'public', source_event_id, 'company_outcome.consent'
  ) on conflict do nothing;
  return jsonb_build_object('outcome_id', outcome_record.id, 'state', outcome_record.state);
end;
$$;

create or replace function public.withdraw_company_proof_outcome_consent(
  requested_outcome_id uuid,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := private.require_active_proof_graph_talent();
  outcome_record public.proof_company_outcomes;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into outcome_record from public.proof_company_outcomes
    where id = requested_outcome_id and talent_user_id = actor_id for update;
  if outcome_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if outcome_record.state = 'withdrawn' then
    return jsonb_build_object('outcome_id', outcome_record.id, 'state', outcome_record.state, 'idempotent', true);
  end if;
  if outcome_record.state <> 'consented' then raise exception 'INVALID_STATE'; end if;
  update public.proof_company_outcomes
    set state = 'withdrawn', withdrawn_at = now(), updated_at = now()
    where id = outcome_record.id returning * into outcome_record;
  perform private.append_proof_reputation_event(
    actor_id, outcome_record.organization_id, outcome_record.public_proof_id,
    outcome_record.verification_proof_id, null, outcome_record.id,
    'company_outcome.withdrawn', 'company_outcome.withdrawn', 'private',
    'The Talent withdrew public consent for this company outcome context.',
    jsonb_build_object('idempotency_key', requested_idempotency_key)
  );
  return jsonb_build_object('outcome_id', outcome_record.id, 'state', outcome_record.state);
end;
$$;

create or replace function public.propose_proof_endorsement(
  requested_public_proof_id uuid,
  requested_skill_key text,
  requested_endorsement_text text,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  proof_record public.talent_public_proofs;
  verification_record public.project_verifications;
  endorsement_record public.proof_endorsements;
begin
  if actor_id is null or requested_idempotency_key is null
    or requested_skill_key !~ '^[a-z0-9-]{1,80}$'
    or char_length(trim(coalesce(requested_endorsement_text, ''))) not between 20 and 600
  then raise exception 'VALIDATION_FAILED'; end if;
  proof_record := private.require_proof_graph_company_owner(requested_public_proof_id);
  if proof_record.skill_key <> requested_skill_key then raise exception 'VALIDATION_FAILED'; end if;
  select * into verification_record from public.project_verifications where id = proof_record.verification_id;
  insert into public.proof_endorsements (
    public_proof_id, verification_proof_id, talent_user_id, organization_id,
    endorsed_by_user_id, skill_key, endorsement_text
  ) values (
    proof_record.id, proof_record.verification_proof_id, proof_record.talent_user_id,
    verification_record.organization_id, actor_id, requested_skill_key,
    trim(requested_endorsement_text)
  ) on conflict (public_proof_id, organization_id, skill_key)
    where state in ('proposed', 'consented')
    do nothing
  returning * into endorsement_record;
  if endorsement_record.id is null then raise exception 'CONFLICT'; end if;
  perform private.append_proof_reputation_event(
    endorsement_record.talent_user_id, endorsement_record.organization_id,
    endorsement_record.public_proof_id, endorsement_record.verification_proof_id,
    null, endorsement_record.id, 'endorsement.proposed', 'endorsement.proposed',
    'private', 'A company submitted an endorsement for the Talent to review before it becomes public.',
    jsonb_build_object('skill_key', endorsement_record.skill_key, 'idempotency_key', requested_idempotency_key)
  );
  return jsonb_build_object('endorsement_id', endorsement_record.id, 'state', endorsement_record.state);
end;
$$;

create or replace function public.consent_proof_endorsement(
  requested_endorsement_id uuid,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := private.require_active_proof_graph_talent();
  endorsement_record public.proof_endorsements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into endorsement_record from public.proof_endorsements
    where id = requested_endorsement_id and talent_user_id = actor_id for update;
  if endorsement_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if endorsement_record.state = 'consented' then
    return jsonb_build_object('endorsement_id', endorsement_record.id, 'state', endorsement_record.state, 'idempotent', true);
  end if;
  if endorsement_record.state <> 'proposed' then raise exception 'INVALID_STATE'; end if;
  perform private.assert_public_proof_chain(endorsement_record.public_proof_id);
  update public.proof_endorsements
    set state = 'consented', consented_at = now(), updated_at = now()
    where id = endorsement_record.id returning * into endorsement_record;
  perform private.append_proof_reputation_event(
    actor_id, endorsement_record.organization_id, endorsement_record.public_proof_id,
    endorsement_record.verification_proof_id, null, endorsement_record.id,
    'endorsement.consent', 'endorsement.confirmed', 'public',
    'The Talent consented to this company endorsement on a verified Proof.',
    jsonb_build_object('skill_key', endorsement_record.skill_key, 'idempotency_key', requested_idempotency_key)
  );
  insert into public.proof_graph_relations (
    talent_user_id, organization_id, public_proof_id, verification_proof_id,
    relation_type, skill_key, verification_state, visibility, source_event_id, source_event_type
  ) values (
    actor_id, endorsement_record.organization_id, endorsement_record.public_proof_id,
    endorsement_record.verification_proof_id, 'endorsement_context', endorsement_record.skill_key,
    'contextual', 'public', endorsement_record.id, 'endorsement.consent'
  ) on conflict do nothing;
  return jsonb_build_object('endorsement_id', endorsement_record.id, 'state', endorsement_record.state);
end;
$$;

create or replace function public.withdraw_proof_endorsement(
  requested_endorsement_id uuid,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := private.require_active_proof_graph_talent();
  endorsement_record public.proof_endorsements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into endorsement_record from public.proof_endorsements
    where id = requested_endorsement_id and talent_user_id = actor_id for update;
  if endorsement_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if endorsement_record.state = 'withdrawn' then
    return jsonb_build_object('endorsement_id', endorsement_record.id, 'state', endorsement_record.state, 'idempotent', true);
  end if;
  if endorsement_record.state <> 'consented' then raise exception 'INVALID_STATE'; end if;
  update public.proof_endorsements
    set state = 'withdrawn', withdrawn_at = now(), updated_at = now()
    where id = endorsement_record.id returning * into endorsement_record;
  perform private.append_proof_reputation_event(
    actor_id, endorsement_record.organization_id, endorsement_record.public_proof_id,
    endorsement_record.verification_proof_id, null, endorsement_record.id,
    'endorsement.withdrawn', 'endorsement.withdrawn', 'private',
    'The Talent withdrew public consent for this company endorsement.',
    jsonb_build_object('idempotency_key', requested_idempotency_key)
  );
  return jsonb_build_object('endorsement_id', endorsement_record.id, 'state', endorsement_record.state);
end;
$$;

create or replace function public.get_public_talent_proof_graph(requested_handle text)
returns jsonb
language sql security definer stable set search_path = public as $$
  with active_proofs as (
    select
      proof.id,
      proof.talent_user_id,
      proof.skill_key,
      proof.verification_method,
      proof.reviewer_attribution,
      proof.reviewer_attribution_is_public,
      proof.verified_at,
      evidence.public_id as evidence_public_id,
      evidence.snapshot->>'title' as evidence_title,
      project_publication.public_id as project_public_id,
      project_publication.snapshot->>'title' as project_title
    from public.talent_profile_publications profile
    join public.talent_public_proofs proof on proof.talent_user_id = profile.user_id
      and proof.status = 'verified'
      and proof.revoked_at is null
      and (proof.expires_at is null or proof.expires_at > now())
      and proof.verification_id is not null
      and proof.verification_proof_id is not null
    join public.project_verifications verification on verification.id = proof.verification_id
      and verification.state = 'verified'
      and verification.current_submission_version_id = proof.submission_version_id
      and verification.rubric_version_id = proof.rubric_version_id
    join public.verification_proofs verification_proof on verification_proof.id = proof.verification_proof_id
      and verification_proof.state = 'public'
      and verification_proof.talent_user_id = proof.talent_user_id
      and proof.skill_key = any (array(select jsonb_array_elements_text(verification_proof.skill_keys)))
    join public.work_evidence_publications evidence on evidence.evidence_id = proof.evidence_id
      and evidence.user_id = proof.talent_user_id
      and evidence.state = 'published'
    left join public.project_workspaces workspace on workspace.id = verification.workspace_id
    left join public.company_project_drafts project on project.id = workspace.project_id
    left join public.company_project_publications project_publication on project_publication.project_id = project.id
      and project.visibility = 'public'
      and project_publication.state in ('published', 'accepting_applications', 'paused')
    where profile.handle = lower(trim(requested_handle))
      and profile.state = 'published'
      and not public.is_reserved_talent_profile_handle(requested_handle)
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'active_verified_proof_count', (select count(*) from active_proofs),
      'verified_skill_count', (select count(distinct skill_key) from active_proofs),
      'consented_company_outcome_count', (
        select count(*) from public.proof_company_outcomes outcome
        join active_proofs proof on proof.id = outcome.public_proof_id
        where outcome.state = 'consented'
      ),
      'latest_verified_at', (select max(verified_at) from active_proofs)
    ),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'proof_id', proof.id,
        'skill_key', proof.skill_key,
        'verification_method', proof.verification_method,
        'verified_at', proof.verified_at,
        'evidence_public_id', proof.evidence_public_id,
        'evidence_title', proof.evidence_title,
        'project_public_id', proof.project_public_id,
        'project_title', proof.project_title,
        'reviewer_attribution', case when proof.reviewer_attribution_is_public then proof.reviewer_attribution else '' end,
        'verification_state', 'human_verified'
      ) order by proof.verified_at desc, proof.id)
      from active_proofs proof
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'skill_key', skill_key,
        'proof_count', proof_count,
        'latest_verified_at', latest_verified_at,
        'evidence', evidence
      ) order by latest_verified_at desc, skill_key)
      from (
        select proof.skill_key, count(*) as proof_count, max(proof.verified_at) as latest_verified_at,
          jsonb_agg(jsonb_build_object(
            'proof_id', proof.id, 'evidence_public_id', proof.evidence_public_id,
            'evidence_title', proof.evidence_title, 'verified_at', proof.verified_at
          ) order by proof.verified_at desc, proof.id) as evidence
        from active_proofs proof group by proof.skill_key
      ) skill_summary
    ), '[]'::jsonb),
    'company_outcomes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', outcome.id, 'proof_id', outcome.public_proof_id,
        'outcome_type', outcome.outcome_type, 'context_summary', outcome.context_summary,
        'consented_at', outcome.consented_at
      ) order by outcome.consented_at desc, outcome.id)
      from public.proof_company_outcomes outcome
      join active_proofs proof on proof.id = outcome.public_proof_id
      where outcome.state = 'consented'
    ), '[]'::jsonb),
    'endorsements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', endorsement.id, 'proof_id', endorsement.public_proof_id,
        'skill_key', endorsement.skill_key, 'endorsement_text', endorsement.endorsement_text,
        'consented_at', endorsement.consented_at
      ) order by endorsement.consented_at desc, endorsement.id)
      from public.proof_endorsements endorsement
      join active_proofs proof on proof.id = endorsement.public_proof_id
      where endorsement.state = 'consented'
    ), '[]'::jsonb)
  )
$$;

create or replace function public.get_private_talent_proof_graph_audit()
returns jsonb
language plpgsql security definer stable set search_path = public, private as $$
declare actor_id uuid := private.require_active_proof_graph_talent();
begin
  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'event_type', event.event_type,
        'visibility', event.visibility, 'event_summary', event.event_summary,
        'source_event_type', event.source_event_type, 'source_event_id', event.source_event_id,
        'public_proof_id', event.public_proof_id, 'occurred_at', event.occurred_at
      ) order by event.occurred_at desc, event.id)
      from public.proof_reputation_events event
      where event.talent_user_id = actor_id
      limit 120
    ), '[]'::jsonb),
    'outcomes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', outcome.id, 'public_proof_id', outcome.public_proof_id,
        'outcome_type', outcome.outcome_type, 'context_summary', outcome.context_summary,
        'state', outcome.state, 'proposed_at', outcome.proposed_at,
        'consented_at', outcome.consented_at, 'withdrawn_at', outcome.withdrawn_at
      ) order by outcome.proposed_at desc, outcome.id)
      from public.proof_company_outcomes outcome where outcome.talent_user_id = actor_id
    ), '[]'::jsonb),
    'endorsements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', endorsement.id, 'public_proof_id', endorsement.public_proof_id,
        'skill_key', endorsement.skill_key, 'endorsement_text', endorsement.endorsement_text,
        'state', endorsement.state, 'proposed_at', endorsement.proposed_at,
        'consented_at', endorsement.consented_at, 'withdrawn_at', endorsement.withdrawn_at
      ) order by endorsement.proposed_at desc, endorsement.id)
      from public.proof_endorsements endorsement where endorsement.talent_user_id = actor_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_admin_proof_graph_audit(maximum_count integer default 120)
returns jsonb
language plpgsql security definer stable set search_path = public, private as $$
begin
  if not private.verification_actor_is_admin() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', event.id, 'talent_user_id', event.talent_user_id,
      'organization_id', event.organization_id, 'public_proof_id', event.public_proof_id,
      'event_type', event.event_type, 'visibility', event.visibility,
      'source_event_type', event.source_event_type, 'source_event_id', event.source_event_id,
      'occurred_at', event.occurred_at
    ) order by event.occurred_at desc, event.id)
    from (
      select * from public.proof_reputation_events
      order by occurred_at desc, id desc
      limit least(greatest(coalesce(maximum_count, 0), 0), 120)
    ) event
  ), '[]'::jsonb);
end;
$$;

revoke all on table public.proof_graph_relations, public.proof_reputation_events,
  public.proof_company_outcomes, public.proof_endorsements from anon, authenticated;
revoke all on function private.append_proof_reputation_event(uuid, uuid, uuid, uuid, uuid, uuid, text, public.proof_reputation_event_type, public.proof_reputation_event_visibility, text, jsonb),
  private.require_active_proof_graph_talent(), private.require_proof_graph_company_owner(uuid),
  private.assert_public_proof_chain(uuid), private.materialize_public_proof_graph()
  from public, anon, authenticated;
revoke all on function public.propose_company_proof_outcome(uuid, public.proof_company_outcome_type, text, uuid),
  public.consent_company_proof_outcome(uuid, uuid), public.withdraw_company_proof_outcome_consent(uuid, uuid),
  public.propose_proof_endorsement(uuid, text, text, uuid), public.consent_proof_endorsement(uuid, uuid),
  public.withdraw_proof_endorsement(uuid, uuid), public.get_public_talent_proof_graph(text),
  public.get_private_talent_proof_graph_audit(), public.get_admin_proof_graph_audit(integer)
  from public, anon;
grant execute on function public.propose_company_proof_outcome(uuid, public.proof_company_outcome_type, text, uuid),
  public.consent_company_proof_outcome(uuid, uuid), public.withdraw_company_proof_outcome_consent(uuid, uuid),
  public.propose_proof_endorsement(uuid, text, text, uuid), public.consent_proof_endorsement(uuid, uuid),
  public.withdraw_proof_endorsement(uuid, uuid), public.get_private_talent_proof_graph_audit(),
  public.get_admin_proof_graph_audit(integer) to authenticated;
grant execute on function public.get_public_talent_proof_graph(text) to anon, authenticated;
