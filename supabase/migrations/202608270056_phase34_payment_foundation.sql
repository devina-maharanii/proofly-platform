-- Phase 34 — Provider-agnostic payment, payout, ledger, and reconciliation foundation.
-- Owner: Payments module. Risk: financial loss, duplicate settlement, cross-tenant exposure,
-- secret/credential leakage, unsupported-market activation, and immutable-record corruption.
-- Rollback: forward compensation only; disable public commands and provider configuration while
-- retaining private payment, ledger, receipt, reconciliation, and audit history.

create type public.payment_provider_name as enum ('stripe');
create type public.payment_provider_mode as enum ('sandbox', 'live');
create type public.payment_provider_configuration_state as enum ('disabled', 'sandbox_ready', 'live_ready');
create type public.payment_market_compliance_state as enum ('blocked', 'limited', 'approved');
create type public.payment_intent_state as enum (
  'required', 'checkout_created', 'payment_processing', 'funded', 'funding_failed',
  'cancelled', 'refunded', 'partially_refunded', 'on_hold', 'disputed',
  'provider_review', 'requires_action', 'reconciled'
);
create type public.payment_release_state as enum (
  'eligible_for_release', 'release_processing', 'released', 'release_failed',
  'on_hold', 'cancelled', 'reconciled'
);
create type public.payout_account_state as enum (
  'not_started', 'onboarding_started', 'requirements_due', 'eligible',
  'under_review', 'disabled', 'rejected'
);
create type public.payout_state as enum (
  'created', 'provider_pending', 'eligible', 'paid', 'failed', 'held',
  'reversed', 'reconciled'
);
create type public.payment_refund_state as enum (
  'requested', 'provider_pending', 'refunded', 'partially_refunded',
  'failed', 'held', 'cancelled'
);
create type public.payment_dispute_source as enum ('platform', 'provider');
create type public.payment_dispute_state as enum ('open', 'under_review', 'resolved', 'closed');
create type public.payment_ledger_direction as enum ('debit', 'credit');
create type public.payment_ledger_account_role as enum (
  'company', 'platform_escrow', 'talent_provider_balance', 'talent_payout',
  'provider_fee', 'platform_fee', 'tax_liability', 'refund'
);
create type public.payment_reconciliation_state as enum ('pending', 'matched', 'mismatched', 'missing', 'duplicate', 'unexplained', 'resolved');
create type public.payment_provider_event_state as enum ('received', 'processed', 'retryable_failed', 'dead_letter', 'ignored');
create type public.payment_reconciliation_run_state as enum ('queued', 'running', 'completed', 'failed');

create table public.payment_provider_configurations (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider_name not null,
  mode public.payment_provider_mode not null default 'sandbox',
  state public.payment_provider_configuration_state not null default 'disabled',
  provider_account_reference text not null unique check (char_length(trim(provider_account_reference)) between 6 and 180),
  configuration_label text not null check (char_length(trim(configuration_label)) between 3 and 160),
  created_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (state = 'sandbox_ready' and mode = 'sandbox')
    or (state = 'live_ready' and mode = 'live')
    or state = 'disabled'
  )
);

create table public.payment_market_compliance_policies (
  id uuid primary key default gen_random_uuid(),
  market_code text not null check (market_code ~ '^[A-Z]{2,8}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state public.payment_market_compliance_state not null default 'blocked',
  provider_payment_capability_confirmed boolean not null default false,
  provider_payout_capability_confirmed boolean not null default false,
  tax_review_confirmed boolean not null default false,
  sanctions_review_confirmed boolean not null default false,
  support_coverage_confirmed boolean not null default false,
  terms_version_label text not null check (char_length(trim(terms_version_label)) between 3 and 120),
  limitation_notice text not null check (char_length(trim(limitation_notice)) between 20 and 900),
  reviewed_by_user_id uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_code, currency),
  check (
    state <> 'approved' or (
      provider_payment_capability_confirmed and provider_payout_capability_confirmed
      and tax_review_confirmed and sanctions_review_confirmed and support_coverage_confirmed
      and reviewed_by_user_id is not null and reviewed_at is not null
    )
  )
);

create table public.company_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete restrict,
  authorized_payer_user_id uuid not null references auth.users(id) on delete restrict,
  provider_customer_reference text unique check (provider_customer_reference is null or char_length(trim(provider_customer_reference)) between 6 and 180),
  status text not null default 'active' check (status in ('active', 'restricted', 'disabled')),
  policy_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_spend_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null default 'active' check (state in ('active', 'paused', 'retired')),
  per_payment_limit_minor bigint not null check (per_payment_limit_minor > 0),
  period_limit_minor bigint not null check (period_limit_minor > 0),
  period_starts_at timestamptz not null,
  period_ends_at timestamptz not null,
  set_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, currency, period_starts_at),
  check (period_ends_at > period_starts_at)
);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  engagement_terms_version_id uuid not null references public.engagement_terms_versions(id) on delete restrict,
  milestone_id uuid references public.engagement_milestones(id) on delete restrict,
  billing_profile_id uuid not null references public.company_billing_profiles(id) on delete restrict,
  provider_configuration_id uuid not null references public.payment_provider_configurations(id) on delete restrict,
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  provider_payment_reference text unique check (provider_payment_reference is null or char_length(trim(provider_payment_reference)) between 6 and 180),
  provider_checkout_reference text unique check (provider_checkout_reference is null or char_length(trim(provider_checkout_reference)) between 6 and 180),
  provider_checkout_expires_at timestamptz,
  state public.payment_intent_state not null default 'required',
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  tax_amount_minor bigint not null default 0 check (tax_amount_minor >= 0),
  funding_total_minor bigint not null check (funding_total_minor > 0),
  expected_talent_net_minor bigint not null check (expected_talent_net_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_idempotency_key uuid not null,
  funded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, payer_user_id, created_idempotency_key),
  check (funding_total_minor = gross_amount_minor + platform_fee_minor + provider_fee_minor + tax_amount_minor),
  check (expected_talent_net_minor <= gross_amount_minor)
);
create unique index payment_intents_live_engagement_funding_idx
  on public.payment_intents(engagement_id)
  where milestone_id is null and state not in ('funding_failed', 'cancelled', 'refunded', 'reconciled');
create index payment_intents_organization_updated_idx on public.payment_intents(organization_id, updated_at desc);
create index payment_intents_engagement_idx on public.payment_intents(engagement_id, created_at desc);

create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  provider_configuration_id uuid not null references public.payment_provider_configurations(id) on delete restrict,
  provider_account_reference text unique check (provider_account_reference is null or char_length(trim(provider_account_reference)) between 6 and 180),
  state public.payout_account_state not null default 'not_started',
  requirements_status_code text not null default '' check (char_length(requirements_status_code) <= 160),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (talent_user_id, provider_configuration_id)
);
create index payout_accounts_talent_updated_idx on public.payout_accounts(talent_user_id, updated_at desc);

create table public.payment_releases (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  milestone_id uuid not null references public.engagement_milestones(id) on delete restrict,
  payout_account_id uuid not null references public.payout_accounts(id) on delete restrict,
  initiated_by_user_id uuid not null references auth.users(id) on delete restrict,
  state public.payment_release_state not null default 'eligible_for_release',
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  tax_withholding_minor bigint not null default 0 check (tax_withholding_minor >= 0),
  expected_talent_net_minor bigint not null check (expected_talent_net_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_release_reference text unique check (provider_release_reference is null or char_length(trim(provider_release_reference)) between 6 and 180),
  requested_idempotency_key uuid not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (milestone_id, initiated_by_user_id, requested_idempotency_key),
  check (expected_talent_net_minor = gross_amount_minor - provider_fee_minor - tax_withholding_minor)
);
create unique index payment_releases_active_milestone_idx
  on public.payment_releases(milestone_id)
  where state not in ('release_failed', 'cancelled', 'reconciled');
create index payment_releases_payment_idx on public.payment_releases(payment_intent_id, created_at desc);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payment_release_id uuid not null unique references public.payment_releases(id) on delete restrict,
  payout_account_id uuid not null references public.payout_accounts(id) on delete restrict,
  talent_user_id uuid not null references auth.users(id) on delete restrict,
  state public.payout_state not null default 'created',
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_payout_reference text unique check (provider_payout_reference is null or char_length(trim(provider_payout_reference)) between 6 and 180),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_talent_updated_idx on public.payouts(talent_user_id, updated_at desc);

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 20 and 1200),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state public.payment_refund_state not null default 'requested',
  provider_refund_reference text unique check (provider_refund_reference is null or char_length(trim(provider_refund_reference)) between 6 and 180),
  original_refund_id uuid references public.payment_refunds(id) on delete restrict,
  requested_idempotency_key uuid not null,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_intent_id, requested_by_user_id, requested_idempotency_key)
);
create index payment_refunds_payment_idx on public.payment_refunds(payment_intent_id, created_at desc);

create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  engagement_dispute_id uuid references public.engagement_disputes(id) on delete restrict,
  source public.payment_dispute_source not null,
  state public.payment_dispute_state not null default 'open',
  provider_dispute_reference text unique check (provider_dispute_reference is null or char_length(trim(provider_dispute_reference)) between 6 and 180),
  reason_code text not null default '' check (char_length(reason_code) <= 160),
  opened_by_user_id uuid references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source = 'provider') = (provider_dispute_reference is not null))
);
create unique index payment_disputes_open_per_payment_idx
  on public.payment_disputes(payment_intent_id, source)
  where state in ('open', 'under_review');

create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_configuration_id uuid not null references public.payment_provider_configurations(id) on delete restrict,
  provider_event_id text not null check (char_length(trim(provider_event_id)) between 6 and 180),
  provider_event_type text not null check (char_length(trim(provider_event_type)) between 3 and 160),
  provider_object_reference text not null check (char_length(trim(provider_object_reference)) between 3 and 180),
  provider_account_reference text not null check (char_length(trim(provider_account_reference)) between 6 and 180),
  normalized_event_type text not null check (normalized_event_type in (
    'funding_succeeded', 'funding_failed', 'payment_action_required', 'payment_hold',
    'release_succeeded', 'release_failed', 'refund_succeeded', 'refund_failed',
    'provider_dispute_opened', 'provider_dispute_closed', 'payout_paid', 'payout_failed',
    'payout_reversed', 'payout_account_updated', 'ignored'
  )),
  occurred_at timestamptz not null,
  redacted_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(redacted_payload) = 'object' and octet_length(redacted_payload::text) <= 16000),
  raw_body_sha256 text not null check (raw_body_sha256 ~ '^[a-f0-9]{64}$'),
  state public.payment_provider_event_state not null default 'received',
  failure_code text check (failure_code is null or char_length(failure_code) <= 120),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0 check (retry_count between 0 and 12),
  unique (provider_configuration_id, provider_event_id)
);
create index payment_provider_events_retry_idx on public.payment_provider_events(state, received_at asc);

create table public.payment_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  operation_type text not null check (operation_type in ('funding', 'release', 'refund', 'payout', 'reversal', 'adjustment')),
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  payment_release_id uuid references public.payment_releases(id) on delete restrict,
  payout_id uuid references public.payouts(id) on delete restrict,
  refund_id uuid references public.payment_refunds(id) on delete restrict,
  payment_dispute_id uuid references public.payment_disputes(id) on delete restrict,
  provider_event_id uuid references public.payment_provider_events(id) on delete restrict,
  entry_type text not null check (char_length(trim(entry_type)) between 3 and 120),
  direction public.payment_ledger_direction not null,
  account_role public.payment_ledger_account_role not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  effective_at timestamptz not null,
  idempotency_key uuid not null,
  reconciliation_state public.payment_reconciliation_state not null default 'pending',
  compensates_ledger_entry_id uuid references public.payment_ledger_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (operation_id, entry_type, direction, account_role)
);
create index payment_ledger_entries_payment_idx on public.payment_ledger_entries(payment_intent_id, created_at asc);
create index payment_ledger_entries_reconciliation_idx on public.payment_ledger_entries(reconciliation_state, effective_at asc);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  payment_release_id uuid references public.payment_releases(id) on delete restrict,
  payout_id uuid references public.payouts(id) on delete restrict,
  refund_id uuid references public.payment_refunds(id) on delete restrict,
  receipt_type text not null check (receipt_type in ('funding', 'release', 'payout', 'refund', 'hold', 'failure', 'requires_action')),
  status_label text not null check (char_length(trim(status_label)) between 3 and 160),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (num_nonnulls(payment_intent_id, payment_release_id, payout_id, refund_id) = 1)
);
create index payment_receipts_created_idx on public.payment_receipts(created_at desc);

create table public.payment_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  provider_configuration_id uuid not null references public.payment_provider_configurations(id) on delete restrict,
  state public.payment_reconciliation_run_state not null default 'queued',
  requested_by_user_id uuid references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and octet_length(summary::text) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_run_id uuid not null references public.payment_reconciliation_runs(id) on delete restrict,
  provider_event_id uuid references public.payment_provider_events(id) on delete restrict,
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  state public.payment_reconciliation_state not null,
  reason_code text not null check (char_length(trim(reason_code)) between 3 and 120),
  resolution_note text not null default '' check (char_length(resolution_note) <= 1000),
  resolved_by_user_id uuid references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_reconciliation_items_state_idx on public.payment_reconciliation_items(state, created_at asc);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  engagement_id uuid references public.engagements(id) on delete restrict,
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  payment_release_id uuid references public.payment_releases(id) on delete restrict,
  payout_id uuid references public.payouts(id) on delete restrict,
  refund_id uuid references public.payment_refunds(id) on delete restrict,
  provider_event_id uuid references public.payment_provider_events(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (char_length(trim(event_type)) between 3 and 120),
  idempotency_key uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2400),
  occurred_at timestamptz not null default now(),
  unique (payment_intent_id, actor_user_id, event_type, idempotency_key)
);
create index payment_events_engagement_occurred_idx on public.payment_events(engagement_id, occurred_at asc);

create or replace function private.payment_active_billing_context(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.active_contexts context
    where context.user_id = auth.uid()
      and context.active_role = 'company_member'
      and context.active_organization_id = target_organization_id
  ) and public.has_organization_permission(target_organization_id, 'billing_member')
$$;

create or replace function private.payment_active_talent_context(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = target_user_id and exists (
    select 1 from public.active_contexts context
    where context.user_id = target_user_id
      and context.active_role = 'talent'
      and context.active_organization_id is null
  )
$$;

create or replace function private.payment_active_admin_context()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_platform_administrator_context()
$$;

create or replace function private.payment_market_is_ready(
  target_market_code text,
  target_currency text,
  target_provider_configuration_id uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.payment_market_compliance_policies compliance
    join public.engagement_market_policies engagement_market
      on engagement_market.market_code = compliance.market_code
      and engagement_market.currency = compliance.currency
    join public.payment_provider_configurations provider
      on provider.id = target_provider_configuration_id
    where compliance.market_code = upper(trim(target_market_code))
      and compliance.currency = upper(trim(target_currency))
      and compliance.state = 'approved'
      and compliance.provider_payment_capability_confirmed
      and compliance.provider_payout_capability_confirmed
      and compliance.tax_review_confirmed
      and compliance.sanctions_review_confirmed
      and compliance.support_coverage_confirmed
      and engagement_market.state in ('approved', 'limited')
      and engagement_market.provider_capability_confirmed
      and provider.state in ('sandbox_ready', 'live_ready')
  )
$$;

create or replace function private.prevent_payment_immutable_rewrite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  raise exception 'IMMUTABLE_RECORD';
end;
$$;

create trigger payment_ledger_entries_immutable_before_update_or_delete
before update or delete on public.payment_ledger_entries
for each row execute function private.prevent_payment_immutable_rewrite();
create trigger payment_receipts_immutable_before_update_or_delete
before update or delete on public.payment_receipts
for each row execute function private.prevent_payment_immutable_rewrite();
create trigger payment_events_immutable_before_update_or_delete
before update or delete on public.payment_events
for each row execute function private.prevent_payment_immutable_rewrite();

alter table public.payment_provider_configurations enable row level security;
alter table public.payment_market_compliance_policies enable row level security;
alter table public.company_billing_profiles enable row level security;
alter table public.company_spend_controls enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.payment_releases enable row level security;
alter table public.payouts enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.payment_ledger_entries enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_reconciliation_runs enable row level security;
alter table public.payment_reconciliation_items enable row level security;
alter table public.payment_events enable row level security;

create policy "billing users can read their company billing profiles"
  on public.company_billing_profiles for select to authenticated
  using (private.payment_active_billing_context(organization_id));
create policy "billing users can read their company spend controls"
  on public.company_spend_controls for select to authenticated
  using (private.payment_active_billing_context(organization_id));
create policy "participants can read payment intents"
  on public.payment_intents for select to authenticated
  using (private.payment_active_billing_context(organization_id) or private.engagement_actor_role(engagement_id) is not null);
create policy "talent can read own payout accounts"
  on public.payout_accounts for select to authenticated
  using (private.payment_active_talent_context(talent_user_id));
create policy "participants can read payment releases"
  on public.payment_releases for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.engagement_actor_role(engagement_id) is not null);
create policy "talent can read own payouts"
  on public.payouts for select to authenticated
  using (private.payment_active_talent_context(talent_user_id));
create policy "participants can read payment refunds"
  on public.payment_refunds for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read payment disputes"
  on public.payment_disputes for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.engagement_actor_role(engagement_id) is not null);
create policy "participants can read payment ledger"
  on public.payment_ledger_entries for select to authenticated
  using (payment_intent_id is not null and exists (select 1 from public.payment_intents intent where intent.id = payment_intent_id and (private.payment_active_billing_context(intent.organization_id) or private.engagement_actor_role(intent.engagement_id) is not null)));
create policy "participants can read payment receipts"
  on public.payment_receipts for select to authenticated
  using (
    (payment_intent_id is not null and exists (
      select 1 from public.payment_intents intent
      where intent.id = payment_intent_id
        and (private.payment_active_billing_context(intent.organization_id) or private.engagement_actor_role(intent.engagement_id) is not null)
    ))
    or (payment_release_id is not null and exists (
      select 1 from public.payment_releases release
      join public.payment_intents intent on intent.id = release.payment_intent_id
      where release.id = payment_release_id
        and (private.payment_active_billing_context(intent.organization_id) or private.engagement_actor_role(release.engagement_id) is not null)
    ))
    or (payout_id is not null and exists (
      select 1 from public.payouts payout
      join public.payment_releases release on release.id = payout.payment_release_id
      join public.payment_intents intent on intent.id = release.payment_intent_id
      where payout.id = payout_id
        and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(payout.talent_user_id))
    ))
    or (refund_id is not null and exists (
      select 1 from public.payment_refunds refund
      join public.payment_intents intent on intent.id = refund.payment_intent_id
      where refund.id = refund_id
        and (private.payment_active_billing_context(intent.organization_id) or private.engagement_actor_role(refund.engagement_id) is not null)
    ))
  );
create policy "administrators can read provider and reconciliation operations"
  on public.payment_provider_events for select to authenticated using (private.payment_active_admin_context());
create policy "administrators can read reconciliation runs"
  on public.payment_reconciliation_runs for select to authenticated using (private.payment_active_admin_context());
create policy "administrators can read reconciliation items"
  on public.payment_reconciliation_items for select to authenticated using (private.payment_active_admin_context());
create policy "participants and administrators can read payment events"
  on public.payment_events for select to authenticated
  using (
    private.payment_active_admin_context()
    or (payment_intent_id is not null and exists (select 1 from public.payment_intents intent where intent.id = payment_intent_id and (private.payment_active_billing_context(intent.organization_id) or private.engagement_actor_role(intent.engagement_id) is not null)))
  );

revoke all on table public.payment_provider_configurations, public.payment_market_compliance_policies,
  public.company_billing_profiles, public.company_spend_controls, public.payment_intents,
  public.payout_accounts, public.payment_releases, public.payouts, public.payment_refunds,
  public.payment_disputes, public.payment_provider_events, public.payment_ledger_entries,
  public.payment_receipts, public.payment_reconciliation_runs, public.payment_reconciliation_items,
  public.payment_events from anon, authenticated;
revoke all on function private.payment_active_billing_context(uuid), private.payment_active_talent_context(uuid),
  private.payment_active_admin_context(), private.payment_market_is_ready(text, text, uuid),
  private.prevent_payment_immutable_rewrite() from public, anon, authenticated;
