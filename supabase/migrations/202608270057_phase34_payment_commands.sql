-- Phase 34 — Guarded payment commands and verified provider-event processing.
-- Provider SDK calls happen only in the server adapter. This migration accepts only normalized,
-- signature-verified provider event facts from a service-role route and never browser callbacks.

alter table public.payment_disputes
  add column opened_idempotency_key uuid,
  add column reason text not null default '' check (char_length(reason) <= 1600),
  add column amount_minor bigint check (amount_minor is null or amount_minor > 0),
  add column currency text check (currency is null or currency ~ '^[A-Z]{3}$');
create unique index payment_disputes_opened_idempotency_idx
  on public.payment_disputes(payment_intent_id, opened_by_user_id, opened_idempotency_key)
  where opened_idempotency_key is not null;

create or replace function private.require_payment_billing_engagement(requested_engagement_id uuid)
returns public.engagements language plpgsql security definer stable set search_path = public, private as $$
declare result public.engagements;
begin
  select * into result from public.engagements engagement
  where engagement.id = requested_engagement_id
    and private.payment_active_billing_context(engagement.organization_id);
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.require_payment_talent_engagement(requested_engagement_id uuid)
returns public.engagements language plpgsql security definer stable set search_path = public, private as $$
declare result public.engagements;
begin
  select * into result from public.engagements engagement
  where engagement.id = requested_engagement_id
    and private.payment_active_talent_context(engagement.talent_user_id);
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.payment_provider_account_is_known(
  target_provider_configuration_id uuid,
  target_provider_account_reference text
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.payment_provider_configurations configuration
    where configuration.id = target_provider_configuration_id
      and configuration.provider_account_reference = trim(target_provider_account_reference)
  ) or exists (
    select 1 from public.payout_accounts account
    where account.provider_configuration_id = target_provider_configuration_id
      and account.provider_account_reference = trim(target_provider_account_reference)
  )
$$;

create or replace function private.append_payment_event(
  target_organization_id uuid,
  target_engagement_id uuid,
  target_payment_intent_id uuid,
  target_payment_release_id uuid,
  target_payout_id uuid,
  target_refund_id uuid,
  target_provider_event_id uuid,
  target_event_type text,
  target_idempotency_key uuid default null,
  target_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public, private as $$
begin
  if char_length(trim(coalesce(target_event_type, ''))) not between 3 and 120
    or jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object'
  then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.payment_events (
    organization_id, engagement_id, payment_intent_id, payment_release_id, payout_id,
    refund_id, provider_event_id, actor_user_id, event_type, idempotency_key, metadata
  ) values (
    target_organization_id, target_engagement_id, target_payment_intent_id,
    target_payment_release_id, target_payout_id, target_refund_id, target_provider_event_id,
    auth.uid(), trim(target_event_type), target_idempotency_key, coalesce(target_metadata, '{}'::jsonb)
  ) on conflict (payment_intent_id, actor_user_id, event_type, idempotency_key)
    where idempotency_key is not null do nothing;
end;
$$;

create or replace function private.append_payment_ledger_entry(
  target_operation_id uuid,
  target_operation_type text,
  target_payment_intent_id uuid,
  target_payment_release_id uuid,
  target_payout_id uuid,
  target_refund_id uuid,
  target_payment_dispute_id uuid,
  target_provider_event_id uuid,
  target_entry_type text,
  target_direction public.payment_ledger_direction,
  target_account_role public.payment_ledger_account_role,
  target_amount_minor bigint,
  target_currency text,
  target_effective_at timestamptz,
  target_idempotency_key uuid,
  target_compensates_ledger_entry_id uuid default null
) returns void language plpgsql security definer set search_path = public, private as $$
begin
  if target_operation_id is null or target_operation_type not in ('funding', 'release', 'refund', 'payout', 'reversal', 'adjustment')
    or char_length(trim(coalesce(target_entry_type, ''))) not between 3 and 120
    or target_amount_minor is null or target_amount_minor <= 0
    or upper(trim(coalesce(target_currency, ''))) !~ '^[A-Z]{3}$'
    or target_idempotency_key is null
  then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.payment_ledger_entries (
    operation_id, operation_type, payment_intent_id, payment_release_id, payout_id,
    refund_id, payment_dispute_id, provider_event_id, entry_type, direction, account_role,
    amount_minor, currency, effective_at, idempotency_key, compensates_ledger_entry_id
  ) values (
    target_operation_id, target_operation_type, target_payment_intent_id,
    target_payment_release_id, target_payout_id, target_refund_id, target_payment_dispute_id,
    target_provider_event_id, trim(target_entry_type), target_direction, target_account_role,
    target_amount_minor, upper(trim(target_currency)), target_effective_at,
    target_idempotency_key, target_compensates_ledger_entry_id
  ) on conflict (operation_id, entry_type, direction, account_role) do nothing;
end;
$$;

create or replace function public.create_company_billing_profile(
  requested_organization_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result public.company_billing_profiles;
begin
  if requested_idempotency_key is null or not private.payment_active_billing_context(requested_organization_id) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into result from public.company_billing_profiles profile
  where profile.organization_id = requested_organization_id for update;
  if result.id is not null then
    if result.authorized_payer_user_id <> auth.uid() then raise exception 'CONFLICT'; end if;
    return jsonb_build_object('billing_profile_id', result.id, 'status', result.status, 'idempotent', true);
  end if;
  insert into public.company_billing_profiles (organization_id, authorized_payer_user_id, policy_acknowledged_at)
  values (requested_organization_id, auth.uid(), now()) returning * into result;
  perform private.append_payment_event(result.organization_id, null, null, null, null, null, null,
    'billing.profile_created', requested_idempotency_key, '{}'::jsonb);
  return jsonb_build_object('billing_profile_id', result.id, 'status', result.status, 'idempotent', false);
end;
$$;

create or replace function public.create_engagement_payment_intent(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  engagement_record public.engagements;
  terms_record public.engagement_terms_versions;
  billing_record public.company_billing_profiles;
  provider_record public.payment_provider_configurations;
  control_record public.company_spend_controls;
  result public.payment_intents;
  gross_amount bigint;
  platform_fee bigint;
  provider_fee bigint := 0;
  tax_amount bigint := 0;
  total_amount bigint;
  already_committed bigint;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_payment_billing_engagement(requested_engagement_id);
  select * into result from public.payment_intents intent
  where intent.engagement_id = engagement_record.id
    and intent.payer_user_id = auth.uid()
    and intent.created_idempotency_key = requested_idempotency_key;
  if result.id is not null then
    return jsonb_build_object('payment_intent_id', result.id, 'state', result.state,
      'gross_amount_minor', result.gross_amount_minor, 'platform_fee_minor', result.platform_fee_minor,
      'provider_fee_minor', result.provider_fee_minor, 'tax_amount_minor', result.tax_amount_minor,
      'funding_total_minor', result.funding_total_minor, 'expected_talent_net_minor', result.expected_talent_net_minor,
      'currency', result.currency, 'idempotent', true);
  end if;
  if engagement_record.state not in ('accepted', 'funding_required') then raise exception 'INVALID_STATE'; end if;
  select * into terms_record from public.engagement_terms_versions terms
  where terms.id = engagement_record.current_terms_version_id and terms.state = 'accepted' for update;
  select * into billing_record from public.company_billing_profiles profile
  where profile.organization_id = engagement_record.organization_id and profile.status = 'active'
    and profile.authorized_payer_user_id = auth.uid() for update;
  select * into provider_record from public.payment_provider_configurations configuration
  where configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready'
  order by configuration.created_at asc limit 1;
  if terms_record.id is null or billing_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if provider_record.id is null then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  if not private.payment_market_is_ready(engagement_record.market_code, engagement_record.currency, provider_record.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE';
  end if;
  gross_amount := (terms_record.terms_snapshot->>'compensation_amount_minor')::bigint;
  platform_fee := (terms_record.terms_snapshot->>'platform_fee_minor')::bigint;
  total_amount := gross_amount + platform_fee + provider_fee + tax_amount;
  select * into control_record from public.company_spend_controls control
  where control.organization_id = engagement_record.organization_id
    and control.currency = engagement_record.currency and control.state = 'active'
    and now() >= control.period_starts_at and now() < control.period_ends_at
  order by control.period_starts_at desc limit 1;
  if control_record.id is not null then
    select coalesce(sum(intent.funding_total_minor), 0) into already_committed
    from public.payment_intents intent
    where intent.organization_id = engagement_record.organization_id
      and intent.currency = engagement_record.currency
      and intent.created_at >= control_record.period_starts_at
      and intent.created_at < control_record.period_ends_at
      and intent.state not in ('funding_failed', 'cancelled', 'refunded', 'reconciled');
    if total_amount > control_record.per_payment_limit_minor
      or already_committed + total_amount > control_record.period_limit_minor
    then raise exception 'VALIDATION_FAILED'; end if;
  end if;
  if engagement_record.state = 'accepted' then
    engagement_record := private.engagement_set_state(engagement_record, 'funding_required', terms_record.id,
      'engagement.funding_required', requested_idempotency_key,
      jsonb_build_object('payment_execution', 'provider_checkout_required'));
  end if;
  insert into public.payment_intents (
    organization_id, engagement_id, engagement_terms_version_id, billing_profile_id,
    provider_configuration_id, payer_user_id, gross_amount_minor, platform_fee_minor,
    provider_fee_minor, tax_amount_minor, funding_total_minor, expected_talent_net_minor,
    currency, created_idempotency_key
  ) values (
    engagement_record.organization_id, engagement_record.id, terms_record.id, billing_record.id,
    provider_record.id, auth.uid(), gross_amount, platform_fee, provider_fee, tax_amount,
    total_amount, gross_amount, engagement_record.currency, requested_idempotency_key
  ) returning * into result;
  perform private.append_payment_event(result.organization_id, result.engagement_id, result.id, null, null, null, null,
    'payment.checkout_requested', requested_idempotency_key,
    jsonb_build_object('provider_mode', provider_record.mode, 'milestone_id', null));
  return jsonb_build_object('payment_intent_id', result.id, 'state', result.state,
    'gross_amount_minor', result.gross_amount_minor, 'platform_fee_minor', result.platform_fee_minor,
    'provider_fee_minor', result.provider_fee_minor, 'tax_amount_minor', result.tax_amount_minor,
    'funding_total_minor', result.funding_total_minor, 'expected_talent_net_minor', result.expected_talent_net_minor,
    'currency', result.currency, 'idempotent', false);
end;
$$;

create or replace function public.record_payment_checkout_created(
  requested_payment_intent_id uuid,
  requested_provider_payment_reference text,
  requested_provider_checkout_reference text,
  requested_checkout_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result public.payment_intents;
begin
  if char_length(trim(coalesce(requested_provider_payment_reference, ''))) not between 6 and 180
    or char_length(trim(coalesce(requested_provider_checkout_reference, ''))) not between 6 and 180
    or requested_checkout_expires_at <= now()
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into result from public.payment_intents intent where intent.id = requested_payment_intent_id for update;
  if result.id is null or result.state not in ('required', 'checkout_created') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.provider_payment_reference is not null
    and (result.provider_payment_reference <> trim(requested_provider_payment_reference)
      or result.provider_checkout_reference <> trim(requested_provider_checkout_reference))
  then raise exception 'CONFLICT'; end if;
  update public.payment_intents set provider_payment_reference = trim(requested_provider_payment_reference),
    provider_checkout_reference = trim(requested_provider_checkout_reference),
    provider_checkout_expires_at = requested_checkout_expires_at, state = 'checkout_created', updated_at = now()
  where id = result.id returning * into result;
  perform private.append_payment_event(result.organization_id, result.engagement_id, result.id, null, null, null, null,
    'payment.checkout_created', null, jsonb_build_object('provider_reference_recorded', true));
  return jsonb_build_object('payment_intent_id', result.id, 'state', result.state);
end;
$$;

create or replace function public.create_payout_onboarding_record(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; provider_record public.payment_provider_configurations; result public.payout_accounts;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_payment_talent_engagement(requested_engagement_id);
  if engagement_record.state not in ('accepted', 'funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment') then
    raise exception 'INVALID_STATE';
  end if;
  select * into provider_record from public.payment_provider_configurations configuration
  where configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready'
  order by configuration.created_at asc limit 1;
  if provider_record.id is null or not private.payment_market_is_ready(engagement_record.market_code, engagement_record.currency, provider_record.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE';
  end if;
  select * into result from public.payout_accounts account
  where account.talent_user_id = engagement_record.talent_user_id and account.provider_configuration_id = provider_record.id for update;
  if result.id is null then
    insert into public.payout_accounts (talent_user_id, provider_configuration_id, state)
    values (engagement_record.talent_user_id, provider_record.id, 'not_started') returning * into result;
  end if;
  perform private.append_payment_event(engagement_record.organization_id, engagement_record.id, null, null, null, null, null,
    'payout.onboarding_requested', requested_idempotency_key, jsonb_build_object('payout_account_id', result.id));
  return jsonb_build_object('payout_account_id', result.id, 'provider_account_reference', result.provider_account_reference,
    'state', result.state, 'idempotent', result.state <> 'not_started');
end;
$$;

create or replace function public.record_payout_onboarding_started(
  requested_payout_account_id uuid,
  requested_provider_account_reference text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result public.payout_accounts;
begin
  if char_length(trim(coalesce(requested_provider_account_reference, ''))) not between 6 and 180 then raise exception 'VALIDATION_FAILED'; end if;
  select * into result from public.payout_accounts account where account.id = requested_payout_account_id for update;
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.provider_account_reference is not null and result.provider_account_reference <> trim(requested_provider_account_reference) then raise exception 'CONFLICT'; end if;
  update public.payout_accounts set provider_account_reference = trim(requested_provider_account_reference),
    state = 'onboarding_started', updated_at = now() where id = result.id returning * into result;
  return jsonb_build_object('payout_account_id', result.id, 'state', result.state);
end;
$$;

create or replace function public.create_payment_release(
  requested_engagement_id uuid,
  requested_milestone_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  engagement_record public.engagements;
  milestone_record public.engagement_milestones;
  payment_record public.payment_intents;
  payout_account_record public.payout_accounts;
  result public.payment_releases;
  pending_total bigint;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_payment_billing_engagement(requested_engagement_id);
  select * into result from public.payment_releases release
  where release.milestone_id = requested_milestone_id and release.initiated_by_user_id = auth.uid()
    and release.requested_idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('payment_release_id', result.id, 'state', result.state, 'idempotent', true); end if;
  select * into milestone_record from public.engagement_milestones milestone
  where milestone.id = requested_milestone_id and milestone.engagement_id = engagement_record.id for update;
  select * into payment_record from public.payment_intents intent
  where intent.engagement_id = engagement_record.id and intent.state = 'funded'
  order by intent.funded_at desc nulls last, intent.created_at desc limit 1 for update;
  select * into payout_account_record from public.payout_accounts account
  where account.talent_user_id = engagement_record.talent_user_id
    and account.provider_configuration_id = payment_record.provider_configuration_id
    and account.state = 'eligible' for update;
  if milestone_record.id is null or milestone_record.state <> 'accepted_for_payment'
    or payment_record.id is null or payout_account_record.id is null
    or exists (select 1 from public.payment_disputes dispute where dispute.payment_intent_id = payment_record.id and dispute.state in ('open', 'under_review'))
  then raise exception 'INVALID_STATE'; end if;
  select coalesce(sum(release.gross_amount_minor), 0) into pending_total
  from public.payment_releases release
  where release.payment_intent_id = payment_record.id
    and release.state not in ('release_failed', 'cancelled', 'reconciled');
  if pending_total + milestone_record.amount_minor > payment_record.gross_amount_minor then raise exception 'CONFLICT'; end if;
  insert into public.payment_releases (
    payment_intent_id, engagement_id, milestone_id, payout_account_id, initiated_by_user_id,
    gross_amount_minor, provider_fee_minor, tax_withholding_minor, expected_talent_net_minor,
    currency, requested_idempotency_key
  ) values (
    payment_record.id, engagement_record.id, milestone_record.id, payout_account_record.id, auth.uid(),
    milestone_record.amount_minor, 0, 0, milestone_record.amount_minor,
    payment_record.currency, requested_idempotency_key
  ) returning * into result;
  perform private.append_payment_event(payment_record.organization_id, engagement_record.id, payment_record.id, result.id, null, null, null,
    'payment.release_requested', requested_idempotency_key, jsonb_build_object('milestone_id', milestone_record.id));
  return jsonb_build_object('payment_release_id', result.id, 'state', result.state,
    'gross_amount_minor', result.gross_amount_minor, 'expected_talent_net_minor', result.expected_talent_net_minor,
    'currency', result.currency, 'idempotent', false);
end;
$$;

create or replace function public.record_payment_release_processing(
  requested_payment_release_id uuid,
  requested_provider_release_reference text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result public.payment_releases;
begin
  if char_length(trim(coalesce(requested_provider_release_reference, ''))) not between 6 and 180 then raise exception 'VALIDATION_FAILED'; end if;
  select * into result from public.payment_releases release where release.id = requested_payment_release_id for update;
  if result.id is null or result.state not in ('eligible_for_release', 'release_processing') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.provider_release_reference is not null and result.provider_release_reference <> trim(requested_provider_release_reference) then raise exception 'CONFLICT'; end if;
  update public.payment_releases set provider_release_reference = trim(requested_provider_release_reference),
    state = 'release_processing', updated_at = now() where id = result.id returning * into result;
  return jsonb_build_object('payment_release_id', result.id, 'state', result.state);
end;
$$;

create or replace function public.request_payment_refund(
  requested_payment_intent_id uuid,
  requested_amount_minor bigint,
  requested_reason text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare payment_record public.payment_intents; result public.payment_refunds; already_requested bigint;
begin
  if requested_idempotency_key is null or requested_amount_minor is null or requested_amount_minor <= 0
    or char_length(trim(coalesce(requested_reason, ''))) not between 20 and 1200
  then raise exception 'VALIDATION_FAILED'; end if;
  select intent.* into payment_record from public.payment_intents intent
  where intent.id = requested_payment_intent_id and private.payment_active_billing_context(intent.organization_id) for update;
  if payment_record.id is null or payment_record.state not in ('funded', 'on_hold') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into result from public.payment_refunds refund
  where refund.payment_intent_id = payment_record.id and refund.requested_by_user_id = auth.uid()
    and refund.requested_idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('refund_id', result.id, 'state', result.state, 'idempotent', true); end if;
  if exists (select 1 from public.payment_releases release where release.payment_intent_id = payment_record.id and release.state in ('release_processing', 'released')) then
    raise exception 'INVALID_STATE';
  end if;
  select coalesce(sum(refund.amount_minor), 0) into already_requested from public.payment_refunds refund
  where refund.payment_intent_id = payment_record.id and refund.state in ('requested', 'provider_pending', 'refunded', 'partially_refunded', 'held');
  if already_requested + requested_amount_minor > payment_record.gross_amount_minor then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.payment_refunds (payment_intent_id, engagement_id, requested_by_user_id, reason, amount_minor, currency, requested_idempotency_key)
  values (payment_record.id, payment_record.engagement_id, auth.uid(), trim(requested_reason), requested_amount_minor, payment_record.currency, requested_idempotency_key)
  returning * into result;
  perform private.append_payment_event(payment_record.organization_id, payment_record.engagement_id, payment_record.id, null, null, result.id, null,
    'payment.refund_requested', requested_idempotency_key, jsonb_build_object('amount_minor', result.amount_minor));
  return jsonb_build_object('refund_id', result.id, 'state', result.state, 'amount_minor', result.amount_minor, 'currency', result.currency, 'idempotent', false);
end;
$$;

create or replace function public.record_payment_refund_processing(
  requested_refund_id uuid,
  requested_provider_refund_reference text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare result public.payment_refunds;
begin
  if char_length(trim(coalesce(requested_provider_refund_reference, ''))) not between 6 and 180 then raise exception 'VALIDATION_FAILED'; end if;
  select * into result from public.payment_refunds refund where refund.id = requested_refund_id for update;
  if result.id is null or result.state not in ('requested', 'provider_pending') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if result.provider_refund_reference is not null and result.provider_refund_reference <> trim(requested_provider_refund_reference) then raise exception 'CONFLICT'; end if;
  update public.payment_refunds set provider_refund_reference = trim(requested_provider_refund_reference), state = 'provider_pending', updated_at = now()
  where id = result.id returning * into result;
  return jsonb_build_object('refund_id', result.id, 'state', result.state);
end;
$$;

create or replace function public.open_platform_payment_dispute(
  requested_payment_intent_id uuid,
  requested_engagement_dispute_id uuid,
  requested_reason text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare payment_record public.payment_intents; engagement_record public.engagements; dispute_record public.engagement_disputes; result public.payment_disputes;
begin
  if requested_idempotency_key is null or requested_engagement_dispute_id is null
    or char_length(trim(coalesce(requested_reason, ''))) not between 30 and 1600
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into payment_record from public.payment_intents intent where intent.id = requested_payment_intent_id for update;
  if payment_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into engagement_record from public.engagements engagement where engagement.id = payment_record.engagement_id;
  if engagement_record.id is null or (private.engagement_actor_role(engagement_record.id) is null and not private.payment_active_billing_context(engagement_record.organization_id)) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into dispute_record from public.engagement_disputes dispute
  where dispute.id = requested_engagement_dispute_id and dispute.engagement_id = engagement_record.id
    and dispute.state in ('open', 'under_review');
  if dispute_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into result from public.payment_disputes dispute
  where dispute.payment_intent_id = payment_record.id and dispute.opened_by_user_id = auth.uid()
    and dispute.opened_idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('payment_dispute_id', result.id, 'state', result.state, 'idempotent', true); end if;
  insert into public.payment_disputes (
    payment_intent_id, engagement_id, engagement_dispute_id, source, state, reason,
    reason_code, amount_minor, currency, opened_by_user_id, opened_idempotency_key
  ) values (
    payment_record.id, engagement_record.id, dispute_record.id, 'platform', 'open', trim(requested_reason),
    'platform_payment_dispute', payment_record.gross_amount_minor, payment_record.currency, auth.uid(), requested_idempotency_key
  ) returning * into result;
  update public.payment_intents set state = 'on_hold', updated_at = now() where id = payment_record.id;
  update public.payment_releases set state = 'on_hold', updated_at = now()
    where payment_intent_id = payment_record.id and state in ('eligible_for_release', 'release_processing');
  perform private.append_payment_event(payment_record.organization_id, payment_record.engagement_id, payment_record.id, null, null, null, null,
    'payment.platform_dispute_opened', requested_idempotency_key, jsonb_build_object('payment_dispute_id', result.id, 'engagement_dispute_id', dispute_record.id));
  return jsonb_build_object('payment_dispute_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.queue_payment_reconciliation(
  requested_provider_configuration_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare configuration_record public.payment_provider_configurations; result public.payment_reconciliation_runs;
begin
  if requested_idempotency_key is null or not private.payment_active_admin_context() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = requested_provider_configuration_id and configuration.state in ('sandbox_ready', 'live_ready');
  if configuration_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into result from public.payment_reconciliation_runs run
  where run.provider_configuration_id = configuration_record.id and run.requested_by_user_id = auth.uid()
    and run.summary->>'idempotency_key' = requested_idempotency_key::text;
  if result.id is not null then return jsonb_build_object('reconciliation_run_id', result.id, 'state', result.state, 'idempotent', true); end if;
  insert into public.payment_reconciliation_runs (provider_configuration_id, requested_by_user_id, summary)
  values (configuration_record.id, auth.uid(), jsonb_build_object('idempotency_key', requested_idempotency_key))
  returning * into result;
  return jsonb_build_object('reconciliation_run_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.record_verified_payment_provider_event(
  requested_provider_configuration_id uuid,
  requested_provider_event_id text,
  requested_provider_event_type text,
  requested_provider_object_reference text,
  requested_provider_account_reference text,
  requested_normalized_event_type text,
  requested_occurred_at timestamptz,
  requested_redacted_payload jsonb,
  requested_raw_body_sha256 text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  configuration_record public.payment_provider_configurations;
  event_record public.payment_provider_events;
  payment_record public.payment_intents;
  release_record public.payment_releases;
  payout_record public.payouts;
  payout_account_record public.payout_accounts;
  refund_record public.payment_refunds;
  payment_dispute_record public.payment_disputes;
  engagement_record public.engagements;
  refund_total bigint;
  payout_reference text;
  account_state public.payout_account_state;
  requirements_code text;
begin
  if char_length(trim(coalesce(requested_provider_event_id, ''))) not between 6 and 180
    or char_length(trim(coalesce(requested_provider_event_type, ''))) not between 3 and 160
    or char_length(trim(coalesce(requested_provider_object_reference, ''))) not between 3 and 180
    or char_length(trim(coalesce(requested_provider_account_reference, ''))) not between 6 and 180
    or requested_normalized_event_type not in ('funding_succeeded', 'funding_failed', 'payment_action_required', 'payment_hold',
      'release_succeeded', 'release_failed', 'refund_succeeded', 'refund_failed', 'provider_dispute_opened',
      'provider_dispute_closed', 'payout_paid', 'payout_failed', 'payout_reversed', 'payout_account_updated', 'ignored')
    or requested_occurred_at is null or requested_occurred_at > now() + interval '5 minutes'
    or requested_occurred_at < now() - interval '31 days'
    or jsonb_typeof(coalesce(requested_redacted_payload, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(requested_redacted_payload, '{}'::jsonb)::text) > 16000
    or coalesce(requested_raw_body_sha256, '') !~ '^[a-f0-9]{64}$'
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = requested_provider_configuration_id and configuration.state in ('sandbox_ready', 'live_ready') for update;
  if configuration_record.id is null or not private.payment_provider_account_is_known(configuration_record.id, requested_provider_account_reference) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into event_record from public.payment_provider_events event
  where event.provider_configuration_id = configuration_record.id and event.provider_event_id = trim(requested_provider_event_id) for update;
  if event_record.id is not null then
    if event_record.state in ('processed', 'ignored', 'dead_letter') then
      return jsonb_build_object('provider_event_id', event_record.id, 'state', event_record.state, 'idempotent', true);
    end if;
    if event_record.retry_count >= 12 then
      update public.payment_provider_events set state = 'dead_letter', failure_code = 'RETRY_LIMIT_REACHED'
      where id = event_record.id;
      return jsonb_build_object('provider_event_id', event_record.id, 'state', 'dead_letter', 'idempotent', true);
    end if;
    update public.payment_provider_events set state = 'received', retry_count = retry_count + 1, failure_code = null
    where id = event_record.id returning * into event_record;
  else
    insert into public.payment_provider_events (
      provider_configuration_id, provider_event_id, provider_event_type, provider_object_reference,
      provider_account_reference, normalized_event_type, occurred_at, redacted_payload, raw_body_sha256
    ) values (
      configuration_record.id, trim(requested_provider_event_id), trim(requested_provider_event_type),
      trim(requested_provider_object_reference), trim(requested_provider_account_reference),
      requested_normalized_event_type, requested_occurred_at, requested_redacted_payload, requested_raw_body_sha256
    ) returning * into event_record;
  end if;

  if requested_normalized_event_type in ('funding_succeeded', 'funding_failed', 'payment_action_required', 'payment_hold', 'provider_dispute_opened', 'provider_dispute_closed') then
    select * into payment_record from public.payment_intents intent
    where intent.provider_configuration_id = configuration_record.id
      and intent.provider_payment_reference = trim(requested_provider_object_reference) for update;
    if payment_record.id is null then
      update public.payment_provider_events set state = 'retryable_failed', failure_code = 'UNMAPPED_PROVIDER_OBJECT', retry_count = 1
      where id = event_record.id;
      return jsonb_build_object('provider_event_id', event_record.id, 'state', 'retryable_failed', 'idempotent', false);
    end if;
    if requested_normalized_event_type = 'funding_succeeded' then
      if payment_record.state not in ('checkout_created', 'payment_processing', 'requires_action') then raise exception 'INVALID_STATE'; end if;
      update public.payment_intents set state = 'funded', funded_at = now(), updated_at = now() where id = payment_record.id returning * into payment_record;
      perform private.append_payment_ledger_entry(payment_record.id, 'funding', payment_record.id, null, null, null, null, event_record.id,
        'funding.company', 'debit', 'company', payment_record.funding_total_minor, payment_record.currency, requested_occurred_at, event_record.id);
      perform private.append_payment_ledger_entry(payment_record.id, 'funding', payment_record.id, null, null, null, null, event_record.id,
        'funding.escrow', 'credit', 'platform_escrow', payment_record.gross_amount_minor, payment_record.currency, requested_occurred_at, event_record.id);
      if payment_record.platform_fee_minor > 0 then
        perform private.append_payment_ledger_entry(payment_record.id, 'funding', payment_record.id, null, null, null, null, event_record.id,
          'funding.platform_fee', 'credit', 'platform_fee', payment_record.platform_fee_minor, payment_record.currency, requested_occurred_at, event_record.id);
      end if;
      if payment_record.provider_fee_minor > 0 then
        perform private.append_payment_ledger_entry(payment_record.id, 'funding', payment_record.id, null, null, null, null, event_record.id,
          'funding.provider_fee', 'credit', 'provider_fee', payment_record.provider_fee_minor, payment_record.currency, requested_occurred_at, event_record.id);
      end if;
      if payment_record.tax_amount_minor > 0 then
        perform private.append_payment_ledger_entry(payment_record.id, 'funding', payment_record.id, null, null, null, null, event_record.id,
          'funding.tax', 'credit', 'tax_liability', payment_record.tax_amount_minor, payment_record.currency, requested_occurred_at, event_record.id);
      end if;
      select * into engagement_record from public.engagements engagement where engagement.id = payment_record.engagement_id for update;
      if engagement_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
      perform private.record_verified_engagement_funding(engagement_record.id, trim(requested_provider_event_id), 'verified_funded');
      insert into public.payment_receipts (payment_intent_id, receipt_type, status_label, amount_minor, currency)
      values (payment_record.id, 'funding', 'Funding verified', payment_record.funding_total_minor, payment_record.currency);
      perform private.append_payment_event(payment_record.organization_id, payment_record.engagement_id, payment_record.id, null, null, null, event_record.id,
        'payment.funded', event_record.id, '{}'::jsonb);
    elsif requested_normalized_event_type = 'funding_failed' then
      update public.payment_intents set state = 'funding_failed', updated_at = now() where id = payment_record.id returning * into payment_record;
      insert into public.payment_receipts (payment_intent_id, receipt_type, status_label, amount_minor, currency)
      values (payment_record.id, 'failure', 'Funding failed', payment_record.funding_total_minor, payment_record.currency);
    elsif requested_normalized_event_type = 'payment_action_required' then
      update public.payment_intents set state = 'requires_action', updated_at = now() where id = payment_record.id returning * into payment_record;
    elsif requested_normalized_event_type = 'payment_hold' then
      update public.payment_intents set state = 'on_hold', updated_at = now() where id = payment_record.id returning * into payment_record;
      update public.payment_releases set state = 'on_hold', updated_at = now()
      where payment_intent_id = payment_record.id and state in ('eligible_for_release', 'release_processing');
      insert into public.payment_receipts (payment_intent_id, receipt_type, status_label, amount_minor, currency)
      values (payment_record.id, 'hold', 'Funding on hold', payment_record.funding_total_minor, payment_record.currency);
    elsif requested_normalized_event_type = 'provider_dispute_opened' then
      insert into public.payment_disputes (payment_intent_id, engagement_id, source, state, provider_dispute_reference, reason_code, amount_minor, currency)
      values (payment_record.id, payment_record.engagement_id, 'provider', 'open', trim(requested_provider_event_id),
        left(coalesce(requested_redacted_payload->>'reason_code', 'provider_dispute'), 160), payment_record.gross_amount_minor, payment_record.currency)
      on conflict (payment_intent_id, source) where state in ('open', 'under_review') do nothing
      returning * into payment_dispute_record;
      update public.payment_intents set state = 'disputed', updated_at = now() where id = payment_record.id returning * into payment_record;
      update public.payment_releases set state = 'on_hold', updated_at = now()
      where payment_intent_id = payment_record.id and state in ('eligible_for_release', 'release_processing');
      insert into public.payment_receipts (payment_intent_id, receipt_type, status_label, amount_minor, currency)
      values (payment_record.id, 'hold', 'Provider dispute under review', payment_record.funding_total_minor, payment_record.currency);
    else
      update public.payment_disputes set state = 'resolved', resolved_at = now(), updated_at = now()
      where payment_intent_id = payment_record.id and source = 'provider' and state in ('open', 'under_review');
      update public.payment_intents set state = 'on_hold', updated_at = now() where id = payment_record.id returning * into payment_record;
    end if;
  elsif requested_normalized_event_type in ('release_succeeded', 'release_failed') then
    select * into release_record from public.payment_releases release
    where release.provider_release_reference = trim(requested_provider_object_reference) for update;
    if release_record.id is null then
      update public.payment_provider_events set state = 'retryable_failed', failure_code = 'UNMAPPED_PROVIDER_OBJECT', retry_count = 1 where id = event_record.id;
      return jsonb_build_object('provider_event_id', event_record.id, 'state', 'retryable_failed', 'idempotent', false);
    end if;
    select * into payment_record from public.payment_intents intent where intent.id = release_record.payment_intent_id for update;
    if requested_normalized_event_type = 'release_succeeded' then
      if release_record.state <> 'release_processing' then raise exception 'INVALID_STATE'; end if;
      update public.payment_releases set state = 'released', released_at = now(), updated_at = now()
      where id = release_record.id returning * into release_record;
      payout_reference := nullif(trim(coalesce(requested_redacted_payload->>'payout_reference', '')), '');
      if payout_reference is not null and char_length(payout_reference) not between 6 and 180 then raise exception 'VALIDATION_FAILED'; end if;
      select * into payout_account_record from public.payout_accounts account where account.id = release_record.payout_account_id;
      insert into public.payouts (payment_release_id, payout_account_id, talent_user_id, state, amount_minor, currency, provider_payout_reference)
      values (release_record.id, payout_account_record.id, payout_account_record.talent_user_id, 'provider_pending', release_record.expected_talent_net_minor, release_record.currency, payout_reference)
      on conflict (payment_release_id) do nothing returning * into payout_record;
      if payout_record.id is null then select * into payout_record from public.payouts payout where payout.payment_release_id = release_record.id for update; end if;
      perform private.append_payment_ledger_entry(release_record.id, 'release', payment_record.id, release_record.id, null, null, null, event_record.id,
        'release.escrow', 'debit', 'platform_escrow', release_record.gross_amount_minor, release_record.currency, requested_occurred_at, event_record.id);
      perform private.append_payment_ledger_entry(release_record.id, 'release', payment_record.id, release_record.id, null, null, null, event_record.id,
        'release.talent_balance', 'credit', 'talent_provider_balance', release_record.expected_talent_net_minor, release_record.currency, requested_occurred_at, event_record.id);
      insert into public.payment_receipts (payment_release_id, receipt_type, status_label, amount_minor, currency)
      values (release_record.id, 'release', 'Release verified', release_record.expected_talent_net_minor, release_record.currency);
      update public.engagement_milestones set state = 'completed', updated_at = now() where id = release_record.milestone_id;
      select * into engagement_record from public.engagements engagement where engagement.id = release_record.engagement_id for update;
      if engagement_record.state = 'accepted_for_payment' and not exists (
        select 1 from public.engagement_milestones milestone
        where milestone.engagement_id = engagement_record.id and milestone.state <> 'completed'
      ) then
        perform private.engagement_set_state(engagement_record, 'completed', engagement_record.current_terms_version_id,
          'engagement.completed', event_record.id, jsonb_build_object('payment_execution', 'verified_provider_release'));
      end if;
    else
      update public.payment_releases set state = 'release_failed', updated_at = now() where id = release_record.id returning * into release_record;
      insert into public.payment_receipts (payment_release_id, receipt_type, status_label, amount_minor, currency)
      values (release_record.id, 'failure', 'Release failed', release_record.expected_talent_net_minor, release_record.currency);
    end if;
  elsif requested_normalized_event_type in ('refund_succeeded', 'refund_failed') then
    select * into refund_record from public.payment_refunds refund
    where refund.provider_refund_reference = trim(requested_provider_object_reference) for update;
    if refund_record.id is null then
      update public.payment_provider_events set state = 'retryable_failed', failure_code = 'UNMAPPED_PROVIDER_OBJECT', retry_count = 1 where id = event_record.id;
      return jsonb_build_object('provider_event_id', event_record.id, 'state', 'retryable_failed', 'idempotent', false);
    end if;
    select * into payment_record from public.payment_intents intent where intent.id = refund_record.payment_intent_id for update;
    if requested_normalized_event_type = 'refund_succeeded' then
      select coalesce(sum(refund.amount_minor), 0) into refund_total from public.payment_refunds refund
      where refund.payment_intent_id = payment_record.id and refund.state in ('refunded', 'partially_refunded') and refund.id <> refund_record.id;
      update public.payment_refunds set state = case when refund_total + refund_record.amount_minor < payment_record.gross_amount_minor then 'partially_refunded' else 'refunded' end,
        refunded_at = now(), updated_at = now() where id = refund_record.id returning * into refund_record;
      update public.payment_intents set state = case when refund_record.state = 'partially_refunded' then 'partially_refunded' else 'refunded' end,
        updated_at = now() where id = payment_record.id returning * into payment_record;
      perform private.append_payment_ledger_entry(refund_record.id, 'refund', payment_record.id, null, null, refund_record.id, null, event_record.id,
        'refund.escrow', 'debit', 'platform_escrow', refund_record.amount_minor, refund_record.currency, requested_occurred_at, event_record.id);
      perform private.append_payment_ledger_entry(refund_record.id, 'refund', payment_record.id, null, null, refund_record.id, null, event_record.id,
        'refund.company', 'credit', 'refund', refund_record.amount_minor, refund_record.currency, requested_occurred_at, event_record.id);
      insert into public.payment_receipts (refund_id, receipt_type, status_label, amount_minor, currency)
      values (refund_record.id, 'refund', case when refund_record.state = 'partially_refunded' then 'Partial refund verified' else 'Refund verified' end,
        refund_record.amount_minor, refund_record.currency);
    else
      update public.payment_refunds set state = 'failed', updated_at = now() where id = refund_record.id returning * into refund_record;
      insert into public.payment_receipts (refund_id, receipt_type, status_label, amount_minor, currency)
      values (refund_record.id, 'failure', 'Refund failed', refund_record.amount_minor, refund_record.currency);
    end if;
  elsif requested_normalized_event_type in ('payout_paid', 'payout_failed', 'payout_reversed') then
    select * into payout_record from public.payouts payout
    where payout.provider_payout_reference = trim(requested_provider_object_reference) for update;
    if payout_record.id is null then
      update public.payment_provider_events set state = 'retryable_failed', failure_code = 'UNMAPPED_PROVIDER_OBJECT', retry_count = 1 where id = event_record.id;
      return jsonb_build_object('provider_event_id', event_record.id, 'state', 'retryable_failed', 'idempotent', false);
    end if;
    select * into release_record from public.payment_releases release where release.id = payout_record.payment_release_id;
    select * into payment_record from public.payment_intents intent where intent.id = release_record.payment_intent_id;
    if requested_normalized_event_type = 'payout_paid' then
      update public.payouts set state = 'paid', paid_at = now(), updated_at = now() where id = payout_record.id returning * into payout_record;
      perform private.append_payment_ledger_entry(payout_record.id, 'payout', payment_record.id, release_record.id, payout_record.id, null, null, event_record.id,
        'payout.talent_balance', 'debit', 'talent_provider_balance', payout_record.amount_minor, payout_record.currency, requested_occurred_at, event_record.id);
      perform private.append_payment_ledger_entry(payout_record.id, 'payout', payment_record.id, release_record.id, payout_record.id, null, null, event_record.id,
        'payout.destination', 'credit', 'talent_payout', payout_record.amount_minor, payout_record.currency, requested_occurred_at, event_record.id);
      insert into public.payment_receipts (payout_id, receipt_type, status_label, amount_minor, currency)
      values (payout_record.id, 'payout', 'Payout verified', payout_record.amount_minor, payout_record.currency);
    elsif requested_normalized_event_type = 'payout_failed' then
      update public.payouts set state = 'failed', updated_at = now() where id = payout_record.id returning * into payout_record;
      insert into public.payment_receipts (payout_id, receipt_type, status_label, amount_minor, currency)
      values (payout_record.id, 'failure', 'Payout failed', payout_record.amount_minor, payout_record.currency);
    else
      update public.payouts set state = 'reversed', updated_at = now() where id = payout_record.id returning * into payout_record;
      insert into public.payment_receipts (payout_id, receipt_type, status_label, amount_minor, currency)
      values (payout_record.id, 'hold', 'Payout reversed for review', payout_record.amount_minor, payout_record.currency);
    end if;
  elsif requested_normalized_event_type = 'payout_account_updated' then
    select * into payout_account_record from public.payout_accounts account
    where account.provider_configuration_id = configuration_record.id
      and account.provider_account_reference = trim(requested_provider_object_reference) for update;
    account_state := nullif(requested_redacted_payload->>'payout_account_state', '')::public.payout_account_state;
    requirements_code := left(coalesce(requested_redacted_payload->>'requirements_status_code', ''), 160);
    if payout_account_record.id is null or account_state is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
    update public.payout_accounts set state = account_state, requirements_status_code = requirements_code,
      last_verified_at = now(), updated_at = now() where id = payout_account_record.id;
  end if;
  update public.payment_provider_events set state = 'processed', processed_at = now(), failure_code = null where id = event_record.id;
  return jsonb_build_object('provider_event_id', event_record.id, 'state', 'processed', 'idempotent', false);
exception when others then
  -- Any raised exception rolls the transaction back, including the provider receipt. The verified
  -- provider delivery therefore retries safely instead of acknowledging a partial financial mutation.
  raise;
end;
$$;

create or replace function public.record_payment_provider_event_failure(
  requested_provider_configuration_id uuid,
  requested_provider_event_id text,
  requested_provider_event_type text,
  requested_provider_object_reference text,
  requested_provider_account_reference text,
  requested_normalized_event_type text,
  requested_occurred_at timestamptz,
  requested_redacted_payload jsonb,
  requested_raw_body_sha256 text,
  requested_failure_code text,
  requested_permanent_failure boolean default false
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare configuration_record public.payment_provider_configurations; event_record public.payment_provider_events; next_state public.payment_provider_event_state;
begin
  if char_length(trim(coalesce(requested_provider_event_id, ''))) not between 6 and 180
    or char_length(trim(coalesce(requested_provider_event_type, ''))) not between 3 and 160
    or char_length(trim(coalesce(requested_provider_object_reference, ''))) not between 3 and 180
    or char_length(trim(coalesce(requested_provider_account_reference, ''))) not between 6 and 180
    or requested_normalized_event_type not in ('funding_succeeded', 'funding_failed', 'payment_action_required', 'payment_hold',
      'release_succeeded', 'release_failed', 'refund_succeeded', 'refund_failed', 'provider_dispute_opened',
      'provider_dispute_closed', 'payout_paid', 'payout_failed', 'payout_reversed', 'payout_account_updated', 'ignored')
    or requested_occurred_at is null or jsonb_typeof(coalesce(requested_redacted_payload, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(requested_redacted_payload, '{}'::jsonb)::text) > 16000
    or coalesce(requested_raw_body_sha256, '') !~ '^[a-f0-9]{64}$'
    or char_length(trim(coalesce(requested_failure_code, ''))) not between 3 and 120
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = requested_provider_configuration_id and configuration.state in ('sandbox_ready', 'live_ready');
  if configuration_record.id is null or not private.payment_provider_account_is_known(configuration_record.id, requested_provider_account_reference) then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into event_record from public.payment_provider_events event
  where event.provider_configuration_id = configuration_record.id and event.provider_event_id = trim(requested_provider_event_id) for update;
  next_state := case when requested_permanent_failure or coalesce(event_record.retry_count, 0) >= 11
    then 'dead_letter'::public.payment_provider_event_state else 'retryable_failed'::public.payment_provider_event_state end;
  if event_record.id is null then
    insert into public.payment_provider_events (
      provider_configuration_id, provider_event_id, provider_event_type, provider_object_reference,
      provider_account_reference, normalized_event_type, occurred_at, redacted_payload, raw_body_sha256,
      state, failure_code, retry_count
    ) values (
      configuration_record.id, trim(requested_provider_event_id), trim(requested_provider_event_type),
      trim(requested_provider_object_reference), trim(requested_provider_account_reference),
      requested_normalized_event_type, requested_occurred_at, requested_redacted_payload, requested_raw_body_sha256,
      next_state, trim(requested_failure_code), 1
    ) returning * into event_record;
  elsif event_record.state <> 'processed' then
    update public.payment_provider_events set state = next_state, failure_code = trim(requested_failure_code),
      retry_count = least(retry_count + 1, 12)
    where id = event_record.id returning * into event_record;
  end if;
  return jsonb_build_object('provider_event_id', event_record.id, 'state', event_record.state);
end;
$$;

revoke all on function private.require_payment_billing_engagement(uuid), private.require_payment_talent_engagement(uuid),
  private.payment_provider_account_is_known(uuid, text), private.append_payment_event(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, jsonb),
  private.append_payment_ledger_entry(uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, public.payment_ledger_direction, public.payment_ledger_account_role, bigint, text, timestamptz, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_company_billing_profile(uuid, uuid), public.create_engagement_payment_intent(uuid, uuid),
  public.create_payout_onboarding_record(uuid, uuid), public.create_payment_release(uuid, uuid, uuid),
  public.request_payment_refund(uuid, bigint, text, uuid), public.open_platform_payment_dispute(uuid, uuid, text, uuid),
  public.queue_payment_reconciliation(uuid, uuid), public.record_payment_checkout_created(uuid, text, text, timestamptz),
  public.record_payout_onboarding_started(uuid, text), public.record_payment_release_processing(uuid, text),
  public.record_payment_refund_processing(uuid, text), public.record_verified_payment_provider_event(uuid, text, text, text, text, text, timestamptz, jsonb, text),
  public.record_payment_provider_event_failure(uuid, text, text, text, text, text, timestamptz, jsonb, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_company_billing_profile(uuid, uuid), public.create_engagement_payment_intent(uuid, uuid),
  public.create_payout_onboarding_record(uuid, uuid), public.create_payment_release(uuid, uuid, uuid),
  public.request_payment_refund(uuid, bigint, text, uuid), public.open_platform_payment_dispute(uuid, uuid, text, uuid),
  public.queue_payment_reconciliation(uuid, uuid) to authenticated;
grant execute on function public.record_payment_checkout_created(uuid, text, text, timestamptz),
  public.record_payout_onboarding_started(uuid, text), public.record_payment_release_processing(uuid, text),
  public.record_payment_refund_processing(uuid, text), public.record_verified_payment_provider_event(uuid, text, text, text, text, text, timestamptz, jsonb, text),
  public.record_payment_provider_event_failure(uuid, text, text, text, text, text, timestamptz, jsonb, text, text, boolean)
  to service_role;
