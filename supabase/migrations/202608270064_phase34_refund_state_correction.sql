-- Phase 34 — Correct refund processing state to the canonical `provider_pending` enum member.

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

create or replace function public.record_payment_refund_processing(
  requested_refund_id uuid,
  requested_provider_refund_reference text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare refund_record public.payment_refunds;
begin
  if char_length(trim(coalesce(requested_provider_refund_reference, ''))) not between 6 and 180 then
    raise exception 'VALIDATION_FAILED';
  end if;
  select * into refund_record from public.payment_refunds refund
  where refund.id = requested_refund_id for update;
  if refund_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if refund_record.state = 'provider_pending'
    and refund_record.provider_refund_reference = trim(requested_provider_refund_reference) then
    return jsonb_build_object('refund_id', refund_record.id, 'idempotent', true);
  end if;
  if refund_record.state <> 'requested' then raise exception 'INVALID_STATE'; end if;
  update public.payment_refunds set state = 'provider_pending',
    provider_refund_reference = trim(requested_provider_refund_reference), updated_at = now()
  where id = refund_record.id returning * into refund_record;
  return jsonb_build_object('refund_id', refund_record.id, 'idempotent', false);
end;
$$;
