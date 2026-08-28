-- Phase 34 — Private contexts for server-owned provider redirect routes.

create or replace function public.get_payment_checkout_context(requested_payment_intent_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare payment_record public.payment_intents; configuration_record public.payment_provider_configurations;
begin
  select * into payment_record from public.payment_intents intent
  where intent.id = requested_payment_intent_id
    and intent.payer_user_id = auth.uid()
    and private.payment_active_billing_context(intent.organization_id)
  for update;
  if payment_record.id is null or payment_record.state not in ('required', 'checkout_created') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = payment_record.provider_configuration_id
    and configuration.provider = 'stripe' and configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready';
  if configuration_record.id is null then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  return jsonb_build_object(
    'payment_intent_id', payment_record.id,
    'provider_configuration_id', configuration_record.id,
    'provider_account_reference', configuration_record.provider_account_reference,
    'amount_minor', payment_record.funding_total_minor,
    'currency', payment_record.currency,
    'checkout_expires_at', payment_record.provider_checkout_expires_at
  );
end;
$$;

create or replace function public.get_payout_onboarding_context(requested_payout_account_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare account_record public.payout_accounts; configuration_record public.payment_provider_configurations;
begin
  select * into account_record from public.payout_accounts account
  where account.id = requested_payout_account_id
    and private.payment_active_talent_context(account.talent_user_id)
  for update;
  if account_record.id is null or account_record.state not in ('not_started', 'onboarding_started', 'requirements_due') then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.id = account_record.provider_configuration_id
    and configuration.provider = 'stripe' and configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready';
  if configuration_record.id is null then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  return jsonb_build_object(
    'payout_account_id', account_record.id,
    'provider_configuration_id', configuration_record.id,
    'provider_account_reference', account_record.provider_account_reference,
    'mode', configuration_record.mode
  );
end;
$$;

revoke all on function public.get_payment_checkout_context(uuid), public.get_payout_onboarding_context(uuid)
  from public, anon;
grant execute on function public.get_payment_checkout_context(uuid), public.get_payout_onboarding_context(uuid)
  to authenticated;
