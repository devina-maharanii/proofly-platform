-- Phase 32 — Explainable Talent Matching
-- Owner: Matching module. Reason: versioned, consented, proof-based recommendations.
-- Risk: private-signal leakage, protected-attribute proxies, opaque ranking, and hiring automation.
-- Rollback: forward-only disable of matching readers/commands; retain restricted audit records.

create type public.matching_participation_state as enum ('enabled', 'paused', 'withdrawn');
create type public.matching_availability_status as enum ('unknown', 'available', 'limited', 'unavailable');
create type public.matching_work_arrangement as enum ('not_specified', 'remote', 'hybrid', 'onsite', 'flexible');
create type public.matching_requirement_availability as enum ('not_specified', 'available_now', 'limited_ok');
create type public.matching_rule_state as enum ('active', 'retired', 'disabled');
create type public.matching_recommendation_kind as enum ('project_for_talent', 'talent_for_project');
create type public.matching_recommendation_state as enum ('active', 'dismissed', 'reported', 'expired');
create type public.matching_feedback_type as enum ('not_relevant', 'wrong_availability', 'incorrect_requirement', 'missing_source', 'other');
create type public.matching_company_action as enum ('shortlist_for_review', 'invite_for_human_review', 'hide_from_team');
create type public.matching_ai_assistance_state as enum ('disabled', 'requested', 'completed', 'failed');

create table public.matching_rule_versions (
  version text primary key check (version ~ '^proof-match-v[0-9]+$'),
  state public.matching_rule_state not null default 'active',
  strategy text not null default 'deterministic_proof_alignment'
    check (strategy = 'deterministic_proof_alignment'),
  rule_definition jsonb not null check (jsonb_typeof(rule_definition) = 'object'),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  check ((state = 'retired') = (retired_at is not null))
);
create unique index matching_rule_versions_one_active_idx
  on public.matching_rule_versions ((state)) where state = 'active';

insert into public.matching_rule_versions (version, state, rule_definition)
values ('proof-match-v1', 'active', jsonb_build_object(
  'version', 'proof-match-v1',
  'strategy', 'deterministic_proof_alignment',
  'included_signals', jsonb_build_array('active_human_verified_public_proof', 'project_required_skill', 'project_helpful_skill', 'explicit_matching_participation', 'voluntary_availability'),
  'excluded_signals', jsonb_build_array('popularity', 'private_message', 'protected_attribute', 'identity_assurance', 'hidden_activity', 'account_age', 'career_gap', 'geography', 'imported_history'),
  'ordering', jsonb_build_array('matched_required_proof_count_desc', 'matched_helpful_proof_count_desc', 'project_updated_at_desc', 'stable_project_id'),
  'limitations', jsonb_build_array('Recommendations do not make hiring, rejection, or proof decisions.', 'Missing information is shown as unknown and is not a negative ability signal.')
)) on conflict (version) do nothing;

create table public.matching_talent_preferences (
  user_id uuid primary key references auth.users(id) on delete restrict,
  project_recommendations_state public.matching_participation_state not null default 'withdrawn',
  company_discoverability_state public.matching_participation_state not null default 'withdrawn',
  availability_status public.matching_availability_status not null default 'unknown',
  share_availability_with_companies boolean not null default false,
  work_arrangement public.matching_work_arrangement not null default 'not_specified',
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 80),
  application_capacity public.matching_availability_status not null default 'unknown',
  updated_at timestamptz not null default now()
);

create table public.matching_project_requirement_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version integer not null check (version > 0),
  source_project_version integer not null check (source_project_version > 0),
  is_current boolean not null default true,
  matching_enabled boolean not null default false,
  required_evidence_expectations jsonb not null default '{}'::jsonb check (jsonb_typeof(required_evidence_expectations) = 'object'),
  availability_expectation public.matching_requirement_availability not null default 'not_specified',
  work_arrangement public.matching_work_arrangement not null default 'not_specified',
  timezone_expectation text not null default '' check (char_length(timezone_expectation) <= 120),
  collaboration_needs text not null default '' check (char_length(collaboration_needs) <= 360),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create unique index matching_project_requirements_current_idx
  on public.matching_project_requirement_revisions (project_id) where is_current;
create index matching_project_requirements_enabled_idx
  on public.matching_project_requirement_revisions (project_id, source_project_version)
  where is_current and matching_enabled;

create table public.matching_recommendations (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  kind public.matching_recommendation_kind not null,
  rule_version text not null references public.matching_rule_versions(version) on delete restrict,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{32}$'),
  input_sources jsonb not null check (jsonb_typeof(input_sources) = 'array'),
  fit_summary jsonb not null check (jsonb_typeof(fit_summary) = 'object'),
  state public.matching_recommendation_state not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (viewer_user_id, kind, project_id, talent_user_id, rule_version, input_fingerprint)
);
create index matching_recommendations_viewer_state_idx
  on public.matching_recommendations (viewer_user_id, kind, state, updated_at desc);
create index matching_recommendations_organization_state_idx
  on public.matching_recommendations (organization_id, project_id, state, updated_at desc)
  where organization_id is not null;

create table public.matching_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.matching_recommendations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  feedback_type public.matching_feedback_type not null,
  detail text not null default '' check (char_length(detail) <= 600),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, idempotency_key)
);

create table public.matching_recommendation_reports (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.matching_recommendations(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  category public.matching_feedback_type not null,
  detail text not null default '' check (char_length(detail) <= 600),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (reporter_user_id, idempotency_key)
);

create table public.matching_human_overrides (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.matching_recommendations(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action public.matching_company_action not null,
  rationale text not null default '' check (char_length(rationale) <= 600),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, idempotency_key)
);

create table public.matching_ai_assistance_audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.company_project_drafts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  state public.matching_ai_assistance_state not null,
  adapter_id text not null check (char_length(adapter_id) between 3 and 120),
  model_reference text not null default '' check (char_length(model_reference) <= 160),
  prompt_version text not null default '' check (char_length(prompt_version) <= 80),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, idempotency_key)
);

create table public.matching_evaluation_metric_definitions (
  metric_key text primary key check (metric_key in ('relevance_feedback_rate', 'explanation_coverage', 'false_positive_signal_rate', 'fairness_review_coverage', 'downstream_human_action_count')),
  description text not null check (char_length(description) between 20 and 360),
  measurement_boundary text not null check (char_length(measurement_boundary) between 20 and 360),
  created_at timestamptz not null default now()
);
insert into public.matching_evaluation_metric_definitions (metric_key, description, measurement_boundary) values
  ('relevance_feedback_rate', 'Share of feedback records marking a recommendation as relevant or not relevant when feedback is voluntarily supplied.', 'No success claim is derived from missing feedback.'),
  ('explanation_coverage', 'Share of active recommendations carrying at least one source-linked reason and one limitation.', 'Measures explanation presence, not hiring quality.'),
  ('false_positive_signal_rate', 'Share of recommendations reported for an incorrect requirement, missing source, or other factual issue.', 'Reports remain safety and quality signals, not reputation penalties.'),
  ('fairness_review_coverage', 'Share of active rule versions with a documented excluded-signal list and evaluation review record.', 'No protected attributes or proxy cohorts are persisted for matching.'),
  ('downstream_human_action_count', 'Count of human-owned shortlist or invite-for-review actions recorded after a recommendation.', 'This is not an outcome, hiring, or quality metric.')
on conflict (metric_key) do nothing;

create table public.matching_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  recommendation_id uuid references public.matching_recommendations(id) on delete restrict,
  project_id uuid references public.company_project_drafts(id) on delete restrict,
  rule_version text references public.matching_rule_versions(version) on delete restrict,
  event_type text not null check (event_type in ('matching.preference_saved', 'matching.project_requirement_saved', 'matching.recommendation_generated', 'matching.recommendation_dismissed', 'matching.feedback_recorded', 'matching.report_recorded', 'matching.human_override_recorded', 'matching.ai_assistance_recorded')),
  idempotency_key uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  unique (actor_user_id, event_type, idempotency_key)
);
create index matching_audit_events_occurred_idx on public.matching_audit_events (occurred_at desc, id desc);

alter table public.matching_rule_versions enable row level security;
alter table public.matching_talent_preferences enable row level security;
alter table public.matching_project_requirement_revisions enable row level security;
alter table public.matching_recommendations enable row level security;
alter table public.matching_recommendation_feedback enable row level security;
alter table public.matching_recommendation_reports enable row level security;
alter table public.matching_human_overrides enable row level security;
alter table public.matching_ai_assistance_audits enable row level security;
alter table public.matching_evaluation_metric_definitions enable row level security;
alter table public.matching_audit_events enable row level security;

create or replace function private.require_matching_talent_actor()
returns uuid language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not exists (
    select 1 from public.active_contexts context
    where context.user_id = actor_id and context.active_role = 'talent'
      and context.active_organization_id is null
  ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return actor_id;
end;
$$;

create or replace function private.require_matching_company_project(requested_project_id uuid)
returns public.company_project_drafts language plpgsql security definer set search_path = public as $$
declare result public.company_project_drafts;
begin
  select project.* into result
  from public.company_project_drafts project
  join public.active_contexts context on context.user_id = auth.uid()
  join public.organization_memberships membership on membership.user_id = auth.uid()
    and membership.organization_id = project.organization_id and membership.status = 'active'
  where project.id = requested_project_id
    and context.active_role = 'company_member'
    and context.active_organization_id = project.organization_id
    and ('owner' = any(membership.permissions) or 'hiring_member' = any(membership.permissions));
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.require_matching_administrator()
returns uuid language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.has_active_platform_administrator_context() then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  return actor_id;
end;
$$;

create or replace function private.matching_active_rule()
returns public.matching_rule_versions language plpgsql security definer stable set search_path = public as $$
declare result public.matching_rule_versions;
begin
  select * into result from public.matching_rule_versions where state = 'active' order by created_at desc limit 1;
  if result.version is null then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  return result;
end;
$$;

create or replace function private.matching_project_is_recommendable(requested_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.company_project_drafts project
    join public.company_project_publications publication on publication.project_id = project.id
    join public.matching_project_requirement_revisions requirement on requirement.project_id = project.id
      and requirement.is_current and requirement.matching_enabled
      and requirement.source_project_version = project.version
    where project.id = requested_project_id
      and project.state = 'accepting_applications'
      and project.visibility = 'public'
      and project.project_type <> 'private_invite_only'
      and project.application_deadline >= current_date
      and publication.state = 'accepting_applications'
  )
$$;

create or replace function private.matching_valid_public_proofs(requested_talent_user_id uuid)
returns table (proof_id uuid, skill_key text, evidence_public_id uuid, verified_at timestamptz)
language sql security definer stable set search_path = public as $$
  select proof.id, proof.skill_key, evidence.public_id, proof.verified_at
  from public.talent_public_proofs proof
  join public.talent_profile_publications profile on profile.user_id = proof.talent_user_id and profile.state = 'published'
  join public.project_verifications verification on verification.id = proof.verification_id
    and verification.state = 'verified' and verification.current_submission_version_id = proof.submission_version_id
    and verification.rubric_version_id = proof.rubric_version_id
  join public.verification_proofs verification_proof on verification_proof.id = proof.verification_proof_id
    and verification_proof.state = 'public' and verification_proof.talent_user_id = proof.talent_user_id
    and proof.skill_key = any (array(select jsonb_array_elements_text(verification_proof.skill_keys)))
  join public.work_evidence_publications evidence on evidence.evidence_id = proof.evidence_id
    and evidence.user_id = proof.talent_user_id and evidence.state = 'published'
  where proof.talent_user_id = requested_talent_user_id
    and proof.status = 'verified' and proof.revoked_at is null
    and (proof.expires_at is null or proof.expires_at > now())
$$;

create or replace function public.save_matching_talent_preferences(
  requested_preferences jsonb, requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare actor_id uuid := private.require_matching_talent_actor(); result public.matching_talent_preferences;
begin
  if requested_idempotency_key is null or jsonb_typeof(requested_preferences) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_preferences) key where key <> all(array['project_recommendations_state','company_discoverability_state','availability_status','share_availability_with_companies','work_arrangement','timezone','application_capacity']))
    or coalesce(requested_preferences->>'project_recommendations_state','withdrawn') not in ('enabled','paused','withdrawn')
    or coalesce(requested_preferences->>'company_discoverability_state','withdrawn') not in ('enabled','paused','withdrawn')
    or coalesce(requested_preferences->>'availability_status','unknown') not in ('unknown','available','limited','unavailable')
    or coalesce(requested_preferences->>'application_capacity','unknown') not in ('unknown','available','limited','unavailable')
    or coalesce(requested_preferences->>'work_arrangement','not_specified') not in ('not_specified','remote','hybrid','onsite','flexible')
    or coalesce(requested_preferences->>'share_availability_with_companies','false') not in ('true','false')
    or char_length(trim(coalesce(requested_preferences->>'timezone','UTC'))) not between 1 and 80
    or octet_length(requested_preferences::text) > 1600 then raise exception 'VALIDATION_FAILED'; end if;
  if exists (select 1 from public.matching_audit_events event where event.actor_user_id = actor_id and event.event_type = 'matching.preference_saved' and event.idempotency_key = requested_idempotency_key) then
    select * into result from public.matching_talent_preferences where user_id = actor_id;
  else
    insert into public.matching_talent_preferences (user_id, project_recommendations_state, company_discoverability_state, availability_status, share_availability_with_companies, work_arrangement, timezone, application_capacity)
    values (actor_id, (requested_preferences->>'project_recommendations_state')::public.matching_participation_state, (requested_preferences->>'company_discoverability_state')::public.matching_participation_state, (requested_preferences->>'availability_status')::public.matching_availability_status, coalesce((requested_preferences->>'share_availability_with_companies')::boolean, false), (requested_preferences->>'work_arrangement')::public.matching_work_arrangement, trim(requested_preferences->>'timezone'), (requested_preferences->>'application_capacity')::public.matching_availability_status)
    on conflict (user_id) do update set project_recommendations_state = excluded.project_recommendations_state, company_discoverability_state = excluded.company_discoverability_state, availability_status = excluded.availability_status, share_availability_with_companies = excluded.share_availability_with_companies, work_arrangement = excluded.work_arrangement, timezone = excluded.timezone, application_capacity = excluded.application_capacity, updated_at = now()
    returning * into result;
    insert into public.matching_audit_events (actor_user_id, event_type, idempotency_key, metadata) values (actor_id, 'matching.preference_saved', requested_idempotency_key, jsonb_build_object('project_recommendations_state', result.project_recommendations_state, 'company_discoverability_state', result.company_discoverability_state));
  end if;
  return jsonb_build_object('project_recommendations_state', result.project_recommendations_state, 'company_discoverability_state', result.company_discoverability_state, 'availability_status', result.availability_status, 'share_availability_with_companies', result.share_availability_with_companies, 'work_arrangement', result.work_arrangement, 'timezone', result.timezone, 'application_capacity', result.application_capacity, 'updated_at', result.updated_at);
end;
$$;

revoke all on table public.matching_rule_versions, public.matching_talent_preferences, public.matching_project_requirement_revisions, public.matching_recommendations, public.matching_recommendation_feedback, public.matching_recommendation_reports, public.matching_human_overrides, public.matching_ai_assistance_audits, public.matching_evaluation_metric_definitions, public.matching_audit_events from anon, authenticated;
revoke all on function private.require_matching_talent_actor(), private.require_matching_company_project(uuid), private.require_matching_administrator(), private.matching_active_rule(), private.matching_project_is_recommendable(uuid), private.matching_valid_public_proofs(uuid) from public, anon, authenticated;
revoke all on function public.save_matching_talent_preferences(jsonb, uuid) from public, anon;
grant execute on function public.save_matching_talent_preferences(jsonb, uuid) to authenticated;
