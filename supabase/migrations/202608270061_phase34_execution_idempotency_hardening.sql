-- Phase 34 — Idempotent, service-role-only execution contexts for provider side effects.
-- `request_payment_refund` first locks its payment-intent row, then searches for
-- the matching pending request; this serializes retries without indexing private free text.

create or replace function public.request_payment_refund(
  requested_payment_intent_id uuid,
  requested_amount_minor bigint,
  requested_reason text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare payment_record public.payment_intents; refund_record public.payment_refunds; permitted_amount bigint;
begin
  if requested_idempotency_key is null or requested_amount_minor <= 0
    or char_length(trim(coalesce(requested_reason, ''))) not between 20 and 1200
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into payment_record from public.payment_intents payment
  where payment.id = requested_payment_intent_id for update;
  if payment_record.id is null or not private.payment_active_billing_context(payment_record.organization_id)
    or payment_record.payer_user_id <> auth.uid() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if payment_record.state not in ('funded', 'on_hold') then raise exception 'INVALID_STATE'; end if;
  select coalesce(sum(refund.amount_minor), 0) into permitted_amount from public.payment_refunds refund
  where refund.payment_intent_id = payment_record.id and refund.state in ('requested', 'provider_pending', 'refunded');
  if permitted_amount + requested_amount_minor > payment_record.gross_amount_minor then raise exception 'VALIDATION_FAILED'; end if;
  select * into refund_record from public.payment_refunds refund
  where refund.payment_intent_id = payment_record.id and refund.requested_by_user_id = auth.uid()
    and refund.amount_minor = requested_amount_minor and refund.reason = trim(requested_reason)
    and refund.state in ('requested', 'provider_pending') limit 1;
  if refund_record.id is not null then return jsonb_build_object('refund_id', refund_record.id, 'idempotent', true); end if;
  insert into public.payment_refunds (
    payment_intent_id, engagement_id, requested_by_user_id, amount_minor, currency, reason, requested_idempotency_key
  ) values (
    payment_record.id, payment_record.engagement_id, auth.uid(), requested_amount_minor, payment_record.currency,
    trim(requested_reason), requested_idempotency_key
  ) returning * into refund_record;
  perform private.append_payment_event(payment_record.organization_id, payment_record.engagement_id, payment_record.id, null, null, refund_record.id, null,
    'payment.refund_requested', requested_idempotency_key, jsonb_build_object('amount_minor', refund_record.amount_minor));
  return jsonb_build_object('refund_id', refund_record.id, 'idempotent', false);
end;
$$;

create or replace function public.get_payment_release_execution_context(requested_payment_release_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare release_record public.payment_releases; payment_record public.payment_intents; payout_account public.payout_accounts; configuration_record public.payment_provider_configurations;
begin
  select * into release_record from public.payment_releases release where release.id = requested_payment_release_id for update;
  if release_record.id is null or release_record.state <> 'eligible_for_release' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into payment_record from public.payment_intents payment where payment.id = release_record.payment_intent_id;
  select * into payout_account from public.payout_accounts account
  where account.id = release_record.payout_account_id and account.provider_configuration_id = payment_record.provider_configuration_id
    and account.state = 'eligible';
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = payment_record.provider_configuration_id and configuration.provider = 'stripe'
    and configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready';
  if payment_record.id is null or payment_record.state <> 'funded' or payout_account.id is null or configuration_record.id is null then
    raise exception 'DEPENDENCY_UNAVAILABLE';
  end if;
  if exists (select 1 from public.payment_disputes dispute where dispute.payment_intent_id = payment_record.id and dispute.state in ('open', 'under_review')) then
    raise exception 'INVALID_STATE';
  end if;
  return jsonb_build_object(
    'payment_release_id', release_record.id, 'amount_minor', release_record.expected_talent_net_minor,
    'currency', release_record.currency, 'provider_account_reference', payout_account.provider_account_reference
  );
end;
$$;

create or replace function public.get_payment_refund_execution_context(requested_refund_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare refund_record public.payment_refunds; payment_record public.payment_intents; configuration_record public.payment_provider_configurations;
begin
  select * into refund_record from public.payment_refunds refund where refund.id = requested_refund_id for update;
  if refund_record.id is null or refund_record.state <> 'requested' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into payment_record from public.payment_intents payment where payment.id = refund_record.payment_intent_id;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = payment_record.provider_configuration_id and configuration.provider = 'stripe'
    and configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready';
  if payment_record.id is null or payment_record.state not in ('funded', 'on_hold')
    or char_length(coalesce(payment_record.provider_payment_reference, '')) < 6 or configuration_record.id is null
  then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  return jsonb_build_object(
    'refund_id', refund_record.id, 'payment_intent_id', payment_record.id,
    'amount_minor', refund_record.amount_minor, 'provider_payment_reference', payment_record.provider_payment_reference
  );
end;
$$;

revoke all on function public.get_payment_release_execution_context(uuid), public.get_payment_refund_execution_context(uuid)
  from public, anon, authenticated;
grant execute on function public.get_payment_release_execution_context(uuid), public.get_payment_refund_execution_context(uuid)
  to service_role;
