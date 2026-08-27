-- Phase 33 — Bounded paid trials and contracts.
-- Owner: Engagements module. Risk: unpaid production work, unversioned terms, membership leakage,
-- unsafe access, unverified financial state, and disputes or evidence being silently rewritten.
-- Rollback: forward compensation only; disable public command grants while retaining participant-restricted
-- agreement, milestone, access, dispute, and audit history. Payment execution remains deferred to Phase 34.

create type public.engagement_type as enum ('paid_trial', 'milestone_contract', 'ongoing_contract');
create type public.engagement_state as enum (
  'draft', 'proposed', 'negotiating', 'accepted', 'funding_required', 'funded',
  'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed',
  'declined', 'expired', 'cancelled_before_start', 'terminated', 'disputed', 'resolved', 'refunded'
);
create type public.engagement_terms_version_state as enum ('draft', 'proposed', 'accepted', 'superseded', 'declined', 'expired', 'withdrawn');
create type public.engagement_participant_role as enum ('talent', 'company');
create type public.engagement_funding_state as enum ('not_requested', 'funding_required', 'verified_funded', 'held', 'refunded', 'settled');
create type public.engagement_milestone_state as enum ('pending_funding', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'cancelled', 'disputed');
create type public.engagement_milestone_decision as enum ('changes_requested', 'accepted_for_payment', 'dispute_raised');
create type public.engagement_access_kind as enum ('repository', 'staging_environment', 'documentation', 'sandbox_data', 'other_non_production');
create type public.engagement_access_state as enum ('requested', 'granted', 'revoked', 'expired', 'denied');
create type public.engagement_dispute_state as enum ('open', 'under_review', 'resolved', 'closed');
create type public.engagement_dispute_category as enum ('scope_creep', 'harassment', 'unsafe_instruction', 'suspected_unpaid_work', 'payment_dependency', 'access_safety', 'quality_or_acceptance', 'other');
create type public.engagement_market_state as enum ('approved', 'limited', 'blocked');

create table public.engagement_market_policies (
  id uuid primary key default gen_random_uuid(),
  market_code text not null check (market_code ~ '^[A-Z]{2,8}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state public.engagement_market_state not null default 'blocked',
  limitation_notice text not null check (char_length(trim(limitation_notice)) between 20 and 900),
  support_route text not null check (char_length(trim(support_route)) between 3 and 240),
  terms_version_label text not null check (char_length(trim(terms_version_label)) between 3 and 120),
  provider_capability_confirmed boolean not null default false,
  approved_by_user_id uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_code, currency),
  check ((state in ('approved', 'limited')) = (provider_capability_confirmed and approved_by_user_id is not null and approved_at is not null))
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.company_project_drafts(id) on delete restrict,
  application_id uuid not null references public.project_applications(id) on delete restrict,
  workspace_id uuid references public.project_workspaces(id) on delete restrict,
  parent_engagement_id uuid references public.engagements(id) on delete restrict,
  engagement_type public.engagement_type not null,
  state public.engagement_state not null default 'draft',
  funding_state public.engagement_funding_state not null default 'not_requested',
  market_code text not null check (market_code ~ '^[A-Z]{2,8}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  current_terms_version_id uuid,
  proposal_expires_at timestamptz,
  accepted_at timestamptz,
  funded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  terminated_at timestamptz,
  cancelled_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state not in ('accepted', 'funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'terminated', 'disputed', 'resolved', 'refunded')) or accepted_at is not null),
  check ((state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'terminated', 'disputed', 'resolved', 'refunded')) or funded_at is not null),
  check ((state = 'in_progress') = (started_at is not null)),
  check ((state <> 'completed') or completed_at is not null),
  check ((state = 'terminated') = (terminated_at is not null)),
  check ((state = 'cancelled_before_start') = (cancelled_at is not null)),
  check ((state = 'disputed') = (disputed_at is not null))
);

create unique index engagements_one_live_paid_trial_per_application_idx
  on public.engagements(application_id)
  where engagement_type = 'paid_trial'
    and state in ('draft', 'proposed', 'negotiating', 'accepted', 'funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'disputed');
create index engagements_talent_updated_idx on public.engagements(talent_user_id, updated_at desc);
create index engagements_organization_updated_idx on public.engagements(organization_id, updated_at desc);
create index engagements_workspace_idx on public.engagements(workspace_id) where workspace_id is not null;

create table public.engagement_terms_versions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  version_number integer not null check (version_number between 1 and 999),
  state public.engagement_terms_version_state not null default 'draft',
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object' and octet_length(terms_snapshot::text) <= 18000),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  proposed_at timestamptz,
  accepted_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, version_number),
  check ((state = 'proposed') = (proposed_at is not null)),
  check ((state = 'accepted') = (accepted_at is not null)),
  check ((state = 'superseded') = (superseded_at is not null))
);

alter table public.engagements
  add constraint engagements_current_terms_version_fk
  foreign key (current_terms_version_id) references public.engagement_terms_versions(id) on delete restrict;

create table public.engagement_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  terms_version_id uuid not null references public.engagement_terms_versions(id) on delete restrict,
  participant_role public.engagement_participant_role not null,
  accepted_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  idempotency_key uuid not null,
  unique (terms_version_id, participant_role),
  unique (engagement_id, accepted_by_user_id, idempotency_key)
);

create table public.engagement_negotiation_entries (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  terms_version_id uuid not null references public.engagement_terms_versions(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  entry_type text not null check (entry_type in ('question', 'change_requested', 'response', 'declined')),
  body text not null check (char_length(trim(body)) between 10 and 1600),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (engagement_id, actor_user_id, idempotency_key)
);

create table public.engagement_milestones (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  terms_version_id uuid not null references public.engagement_terms_versions(id) on delete restrict,
  milestone_index integer not null check (milestone_index between 0 and 7),
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null check (char_length(trim(description)) between 10 and 1400),
  deliverable_type text not null check (char_length(trim(deliverable_type)) between 3 and 120),
  definition_of_done text not null check (char_length(trim(definition_of_done)) between 20 and 1600),
  due_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  revision_allowance integer not null check (revision_allowance between 0 and 8),
  approver_role public.engagement_participant_role not null default 'company',
  timeout_policy text not null check (char_length(trim(timeout_policy)) between 10 and 360),
  evidence_policy text not null check (char_length(trim(evidence_policy)) between 10 and 600),
  linked_task_ids uuid[] not null default '{}'::uuid[] check (cardinality(linked_task_ids) <= 8),
  state public.engagement_milestone_state not null default 'pending_funding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, terms_version_id, milestone_index)
);
create index engagement_milestones_engagement_idx on public.engagement_milestones(engagement_id, milestone_index);

create table public.engagement_milestone_submissions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  milestone_id uuid not null references public.engagement_milestones(id) on delete restrict,
  workspace_submission_version_id uuid not null references public.project_workspace_submission_versions(id) on delete restrict,
  version_number integer not null check (version_number between 1 and 999),
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  summary text not null check (char_length(trim(summary)) between 10 and 1000),
  known_limitations text not null default '' check (char_length(known_limitations) <= 1400),
  created_at timestamptz not null default now(),
  unique (milestone_id, version_number),
  unique (milestone_id, workspace_submission_version_id)
);

create table public.engagement_milestone_decisions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  milestone_id uuid not null references public.engagement_milestones(id) on delete restrict,
  milestone_submission_id uuid references public.engagement_milestone_submissions(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  decision public.engagement_milestone_decision not null,
  rationale text not null check (char_length(trim(rationale)) between 20 and 1600),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (engagement_id, actor_user_id, idempotency_key)
);

create table public.engagement_access_grants (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  granted_to_user_id uuid not null references auth.users(id) on delete restrict,
  requested_by_role public.engagement_participant_role not null,
  access_kind public.engagement_access_kind not null,
  resource_label text not null check (char_length(trim(resource_label)) between 3 and 240),
  purpose text not null check (char_length(trim(purpose)) between 10 and 600),
  state public.engagement_access_state not null default 'requested',
  granted_by_user_id uuid references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'granted') = (granted_by_user_id is not null)),
  check ((state = 'revoked') = (revoked_at is not null))
);
create index engagement_access_grants_live_idx on public.engagement_access_grants(engagement_id, granted_to_user_id, expires_at) where state = 'granted';

create table public.engagement_disputes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  milestone_id uuid references public.engagement_milestones(id) on delete restrict,
  opened_by_user_id uuid not null references auth.users(id) on delete restrict,
  category public.engagement_dispute_category not null,
  reason text not null check (char_length(trim(reason)) between 30 and 1800),
  requested_remedy text not null check (char_length(trim(requested_remedy)) between 20 and 1200),
  evidence_submission_version_ids uuid[] not null default '{}'::uuid[] check (cardinality(evidence_submission_version_ids) <= 8),
  state public.engagement_dispute_state not null default 'open',
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, milestone_id, opened_by_user_id, state)
);

create table public.engagement_dispute_resolutions (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.engagement_disputes(id) on delete restrict,
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  resolved_by_user_id uuid not null references auth.users(id) on delete restrict,
  outcome text not null check (outcome in ('returned_to_parties', 'terminated_with_hold', 'cancelled_before_start', 'escalated_to_payment_provider', 'no_platform_action')),
  resolution_summary text not null check (char_length(trim(resolution_summary)) between 30 and 1800),
  created_at timestamptz not null default now(),
  unique (dispute_id)
);

create table public.engagement_change_orders (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  base_terms_version_id uuid not null references public.engagement_terms_versions(id) on delete restrict,
  proposed_by_user_id uuid not null references auth.users(id) on delete restrict,
  additive_scope text not null check (char_length(trim(additive_scope)) between 20 and 1600),
  additive_milestones jsonb not null default '[]'::jsonb check (jsonb_typeof(additive_milestones) = 'array' and jsonb_array_length(additive_milestones) between 1 and 8),
  state text not null default 'proposed' check (state in ('proposed', 'accepted', 'declined', 'withdrawn')),
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'accepted') = (accepted_at is not null)),
  check ((state = 'declined') = (declined_at is not null))
);

create table public.engagement_events (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  terms_version_id uuid references public.engagement_terms_versions(id) on delete restrict,
  milestone_id uuid references public.engagement_milestones(id) on delete restrict,
  dispute_id uuid references public.engagement_disputes(id) on delete restrict,
  event_type text not null check (event_type in (
    'engagement.draft_created', 'engagement.draft_saved', 'engagement.terms_proposed',
    'engagement.negotiation_recorded', 'engagement.terms_accepted', 'engagement.declined',
    'engagement.expired', 'engagement.funding_required', 'engagement.funding_verified',
    'engagement.workspace_linked', 'engagement.started', 'engagement.cancelled_before_start',
    'engagement.terminated', 'engagement.completed', 'engagement.disputed', 'engagement.resolved',
    'milestone.submitted', 'milestone.changes_requested', 'milestone.accepted_for_payment',
    'access.requested', 'access.granted', 'access.revoked', 'change_order.proposed',
    'change_order.accepted', 'change_order.declined'
  )),
  previous_state public.engagement_state,
  next_state public.engagement_state,
  idempotency_key uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2400),
  occurred_at timestamptz not null default now(),
  unique (engagement_id, actor_user_id, event_type, idempotency_key)
);
create index engagement_events_engagement_occurred_idx on public.engagement_events(engagement_id, occurred_at asc);

create table public.engagement_funding_events (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  provider_event_reference text not null check (char_length(trim(provider_event_reference)) between 16 and 160),
  provider_status text not null check (provider_status in ('verified_funded', 'held', 'refunded', 'settled')),
  recorded_by_user_id uuid references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (provider_event_reference)
);

alter table public.engagement_market_policies enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_terms_versions enable row level security;
alter table public.engagement_terms_acceptances enable row level security;
alter table public.engagement_negotiation_entries enable row level security;
alter table public.engagement_milestones enable row level security;
alter table public.engagement_milestone_submissions enable row level security;
alter table public.engagement_milestone_decisions enable row level security;
alter table public.engagement_access_grants enable row level security;
alter table public.engagement_disputes enable row level security;
alter table public.engagement_dispute_resolutions enable row level security;
alter table public.engagement_change_orders enable row level security;
alter table public.engagement_events enable row level security;
alter table public.engagement_funding_events enable row level security;

create or replace function private.engagement_talent_context(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.active_contexts context
    where context.user_id = target_user_id
      and context.active_role = 'talent'
      and context.active_organization_id is null
  )
$$;

create or replace function private.engagement_company_context(target_organization_id uuid, required_permission public.company_permission default 'hiring_member')
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.active_contexts context
    where context.user_id = auth.uid()
      and context.active_role = 'company_member'
      and context.active_organization_id = target_organization_id
  ) and public.has_organization_permission(target_organization_id, required_permission)
$$;

create or replace function private.engagement_actor_role(target_engagement_id uuid)
returns public.engagement_participant_role language plpgsql stable security definer set search_path = public as $$
declare result public.engagements;
begin
  select * into result from public.engagements where id = target_engagement_id;
  if result.id is null or auth.uid() is null then return null; end if;
  if result.talent_user_id = auth.uid() and private.engagement_talent_context(auth.uid()) then return 'talent'::public.engagement_participant_role; end if;
  if private.engagement_company_context(result.organization_id, 'hiring_member') then return 'company'::public.engagement_participant_role; end if;
  return null;
end;
$$;

create or replace function private.require_engagement_participant(target_engagement_id uuid)
returns public.engagements language plpgsql stable security definer set search_path = public, private as $$
declare result public.engagements;
begin
  select * into result from public.engagements where id = target_engagement_id;
  if result.id is null or private.engagement_actor_role(result.id) is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.require_engagement_company_owner(target_engagement_id uuid)
returns public.engagements language plpgsql stable security definer set search_path = public, private as $$
declare result public.engagements;
begin
  select * into result from public.engagements where id = target_engagement_id;
  if result.id is null or not private.engagement_company_context(result.organization_id, 'owner') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.engagement_market_is_supported(target_market_code text, target_currency text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.engagement_market_policies policy
    where policy.market_code = upper(trim(target_market_code))
      and policy.currency = upper(trim(target_currency))
      and policy.state in ('approved', 'limited')
      and policy.provider_capability_confirmed
  )
$$;

create or replace function private.engagement_terms_payload_is_valid(
  target_type public.engagement_type,
  requested_terms jsonb
) returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare milestone jsonb;
begin
  if jsonb_typeof(requested_terms) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_terms) key where key <> all(array[
      'summary', 'scope', 'deliverables', 'exclusions', 'dependencies', 'assumptions',
      'start_date', 'deadline', 'expected_effort_hours', 'timezone', 'communication_cadence',
      'compensation_amount_minor', 'currency', 'platform_fee_minor', 'taxes_and_fees_note',
      'payment_trigger', 'payment_cadence', 'funding_requirement', 'acceptance_criteria', 'revision_allowance',
      'access_terms', 'confidentiality_terms', 'ownership_terms', 'license_terms',
      'portfolio_visibility', 'cancellation_terms', 'termination_terms', 'dispute_terms',
      'support_route', 'market_code', 'market_limitation_notice', 'milestones'
    ]))
    or char_length(trim(coalesce(requested_terms->>'summary', ''))) not between 20 and 600
    or char_length(trim(coalesce(requested_terms->>'scope', ''))) not between 30 and 1800
    or char_length(trim(coalesce(requested_terms->>'deliverables', ''))) not between 20 and 1800
    or char_length(trim(coalesce(requested_terms->>'exclusions', ''))) not between 10 and 900
    or char_length(trim(coalesce(requested_terms->>'dependencies', ''))) > 900
    or char_length(trim(coalesce(requested_terms->>'assumptions', ''))) > 900
    or coalesce(requested_terms->>'start_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(requested_terms->>'deadline', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(requested_terms->>'expected_effort_hours', '') !~ '^[1-9][0-9]{0,3}$'
    or char_length(trim(coalesce(requested_terms->>'timezone', ''))) not between 1 and 80
    or char_length(trim(coalesce(requested_terms->>'communication_cadence', ''))) not between 5 and 240
    or coalesce(requested_terms->>'compensation_amount_minor', '') !~ '^[1-9][0-9]{0,14}$'
    or coalesce(requested_terms->>'currency', '') !~ '^[A-Z]{3}$'
    or coalesce(requested_terms->>'platform_fee_minor', '') !~ '^[0-9]{1,14}$'
    or char_length(trim(coalesce(requested_terms->>'taxes_and_fees_note', ''))) not between 10 and 600
    or coalesce(requested_terms->>'payment_trigger', '') not in ('milestone_accepted', 'engagement_completed')
    or coalesce(requested_terms->>'payment_cadence', '') not in ('per_milestone', 'weekly', 'biweekly', 'monthly')
    or coalesce(requested_terms->>'funding_requirement', '') <> 'provider_verified_before_work'
    or char_length(trim(coalesce(requested_terms->>'acceptance_criteria', ''))) not between 20 and 1800
    or coalesce(requested_terms->>'revision_allowance', '') !~ '^[0-8]$'
    or jsonb_typeof(coalesce(requested_terms->'access_terms', '{}'::jsonb)) <> 'object'
    or coalesce(requested_terms->'access_terms'->>'production_access', '') <> 'blocked'
    or coalesce(requested_terms->'access_terms'->>'personal_credentials', '') <> 'prohibited'
    or char_length(trim(coalesce(requested_terms->'access_terms'->>'approved_tools', ''))) > 600
    or char_length(trim(coalesce(requested_terms->>'confidentiality_terms', ''))) not between 10 and 1200
    or char_length(trim(coalesce(requested_terms->>'ownership_terms', ''))) not between 10 and 1200
    or char_length(trim(coalesce(requested_terms->>'license_terms', ''))) not between 10 and 1200
    or coalesce(requested_terms->>'portfolio_visibility', '') not in ('private_until_explicit_consent', 'not_permitted')
    or char_length(trim(coalesce(requested_terms->>'cancellation_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'termination_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'dispute_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'support_route', ''))) not between 3 and 240
    or coalesce(requested_terms->>'market_code', '') !~ '^[A-Z]{2,8}$'
    or char_length(trim(coalesce(requested_terms->>'market_limitation_notice', ''))) not between 20 and 900
    or jsonb_typeof(coalesce(requested_terms->'milestones', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_terms->'milestones', '[]'::jsonb)) not between 1 and 8
    or octet_length(requested_terms::text) > 18000
  then return false; end if;
  if target_type = 'paid_trial' and (jsonb_array_length(requested_terms->'milestones') <> 1 or (requested_terms->>'expected_effort_hours')::integer > 160 or requested_terms->>'payment_cadence' <> 'per_milestone') then return false; end if;
  if target_type = 'ongoing_contract' and requested_terms->>'payment_cadence' = 'per_milestone' then return false; end if;
  for milestone in select value from jsonb_array_elements(requested_terms->'milestones') loop
    if jsonb_typeof(milestone) <> 'object'
      or exists (select 1 from jsonb_object_keys(milestone) key where key <> all(array['title','description','deliverable_type','definition_of_done','due_date','amount_minor','currency','revision_allowance','approver_role','timeout_policy','evidence_policy','linked_task_ids']))
      or char_length(trim(coalesce(milestone->>'title', ''))) not between 3 and 160
      or char_length(trim(coalesce(milestone->>'description', ''))) not between 10 and 1400
      or char_length(trim(coalesce(milestone->>'deliverable_type', ''))) not between 3 and 120
      or char_length(trim(coalesce(milestone->>'definition_of_done', ''))) not between 20 and 1600
      or coalesce(milestone->>'due_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(milestone->>'amount_minor', '') !~ '^[1-9][0-9]{0,14}$'
      or milestone->>'currency' <> requested_terms->>'currency'
      or coalesce(milestone->>'revision_allowance', '') !~ '^[0-8]$'
      or coalesce(milestone->>'approver_role', '') <> 'company'
      or char_length(trim(coalesce(milestone->>'timeout_policy', ''))) not between 10 and 360
      or char_length(trim(coalesce(milestone->>'evidence_policy', ''))) not between 10 and 600
      or jsonb_typeof(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) > 8
      or exists (select 1 from jsonb_array_elements_text(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) item where item !~ '^[0-9a-fA-F-]{36}$')
    then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.append_engagement_event(
  target_engagement_id uuid, target_terms_version_id uuid, target_milestone_id uuid,
  target_dispute_id uuid, target_event_type text, target_previous_state public.engagement_state,
  target_next_state public.engagement_state, target_idempotency_key uuid, target_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  select * into engagement_record from public.engagements where id = target_engagement_id;
  if engagement_record.id is null or jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.engagement_events (engagement_id, organization_id, actor_user_id, terms_version_id, milestone_id, dispute_id, event_type, previous_state, next_state, idempotency_key, metadata)
  values (target_engagement_id, engagement_record.organization_id, auth.uid(), target_terms_version_id, target_milestone_id, target_dispute_id, target_event_type, target_previous_state, target_next_state, target_idempotency_key, coalesce(target_metadata, '{}'::jsonb))
  on conflict (engagement_id, actor_user_id, event_type, idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

create or replace function private.prevent_engagement_immutable_rewrite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'IMMUTABLE_RECORD';
end;
$$;

create or replace function private.prevent_locked_engagement_terms_rewrite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.engagement_id <> old.engagement_id
    or new.version_number <> old.version_number
    or new.created_by_user_id <> old.created_by_user_id
  then raise exception 'IMMUTABLE_RECORD'; end if;
  if old.state = 'draft' then return new; end if;
  if old.state = 'proposed'
    and new.state in ('accepted', 'superseded', 'declined', 'expired', 'withdrawn')
    and new.terms_snapshot = old.terms_snapshot
    and new.created_at = old.created_at
  then return new; end if;
  raise exception 'IMMUTABLE_RECORD';
end;
$$;

create trigger engagement_terms_versions_locked_before_update
before update on public.engagement_terms_versions
for each row execute function private.prevent_locked_engagement_terms_rewrite();
create trigger engagement_terms_versions_immutable_before_delete
before delete on public.engagement_terms_versions
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_terms_acceptances_immutable_before_update_or_delete
before update or delete on public.engagement_terms_acceptances
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_negotiation_entries_immutable_before_update_or_delete
before update or delete on public.engagement_negotiation_entries
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_milestone_submissions_immutable_before_update_or_delete
before update or delete on public.engagement_milestone_submissions
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_milestone_decisions_immutable_before_update_or_delete
before update or delete on public.engagement_milestone_decisions
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_dispute_resolutions_immutable_before_update_or_delete
before update or delete on public.engagement_dispute_resolutions
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_events_immutable_before_update_or_delete
before update or delete on public.engagement_events
for each row execute function private.prevent_engagement_immutable_rewrite();
create trigger engagement_funding_events_immutable_before_update_or_delete
before update or delete on public.engagement_funding_events
for each row execute function private.prevent_engagement_immutable_rewrite();

create policy "participants can read engagements" on public.engagements for select to authenticated using (private.engagement_actor_role(id) is not null);
create policy "participants can read engagement terms" on public.engagement_terms_versions for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read engagement acceptances" on public.engagement_terms_acceptances for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read negotiation entries" on public.engagement_negotiation_entries for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read milestones" on public.engagement_milestones for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read milestone submissions" on public.engagement_milestone_submissions for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read milestone decisions" on public.engagement_milestone_decisions for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read relevant access grants" on public.engagement_access_grants for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read disputes" on public.engagement_disputes for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read dispute resolutions" on public.engagement_dispute_resolutions for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read change orders" on public.engagement_change_orders for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read engagement audit" on public.engagement_events for select to authenticated using (private.engagement_actor_role(engagement_id) is not null);

revoke all on table public.engagement_market_policies, public.engagements, public.engagement_terms_versions, public.engagement_terms_acceptances, public.engagement_negotiation_entries, public.engagement_milestones, public.engagement_milestone_submissions, public.engagement_milestone_decisions, public.engagement_access_grants, public.engagement_disputes, public.engagement_dispute_resolutions, public.engagement_change_orders, public.engagement_events, public.engagement_funding_events from anon, authenticated;
revoke all on function private.engagement_talent_context(uuid), private.engagement_company_context(uuid, public.company_permission), private.engagement_actor_role(uuid), private.require_engagement_participant(uuid), private.require_engagement_company_owner(uuid), private.engagement_market_is_supported(text, text), private.engagement_terms_payload_is_valid(public.engagement_type, jsonb), private.append_engagement_event(uuid, uuid, uuid, uuid, text, public.engagement_state, public.engagement_state, uuid, jsonb), private.prevent_engagement_immutable_rewrite(), private.prevent_locked_engagement_terms_rewrite() from public, anon, authenticated;
