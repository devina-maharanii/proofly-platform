-- Phase 34 — Persist a provider refund reference before accepting its webhook confirmation.

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
  if refund_record.state = 'provider_processing'
    and refund_record.provider_refund_reference = trim(requested_provider_refund_reference) then
    return jsonb_build_object('refund_id', refund_record.id, 'idempotent', true);
  end if;
  if refund_record.state <> 'requested' then raise exception 'INVALID_STATE'; end if;
  update public.payment_refunds set state = 'provider_processing',
    provider_refund_reference = trim(requested_provider_refund_reference), updated_at = now()
  where id = refund_record.id returning * into refund_record;
  return jsonb_build_object('refund_id', refund_record.id, 'idempotent', false);
end;
$$;

revoke all on function public.record_payment_refund_processing(uuid, text) from public, anon, authenticated;
grant execute on function public.record_payment_refund_processing(uuid, text) to service_role;
