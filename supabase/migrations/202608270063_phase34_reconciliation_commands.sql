-- Phase 34 — Human-accountable, provider-observed reconciliation; never a settlement authority.

alter table public.payment_reconciliation_runs add column idempotency_key uuid;
create unique index payment_reconciliation_runs_idempotency_idx
  on public.payment_reconciliation_runs(requested_by_user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.start_payment_reconciliation_run(
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare configuration_record public.payment_provider_configurations; run_record public.payment_reconciliation_runs;
begin
  if requested_idempotency_key is null or not private.payment_active_admin_context() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into run_record from public.payment_reconciliation_runs run
  where run.requested_by_user_id = auth.uid() and run.idempotency_key = requested_idempotency_key;
  if run_record.id is not null then return jsonb_build_object('reconciliation_run_id', run_record.id, 'idempotent', true); end if;
  select * into configuration_record from public.payment_provider_configurations configuration
  where configuration.provider = 'stripe' and configuration.mode = 'sandbox' and configuration.state = 'sandbox_ready'
  order by configuration.updated_at desc limit 1;
  if configuration_record.id is null then raise exception 'DEPENDENCY_UNAVAILABLE'; end if;
  insert into public.payment_reconciliation_runs (provider_configuration_id, state, requested_by_user_id, idempotency_key, started_at)
  values (configuration_record.id, 'running', auth.uid(), requested_idempotency_key, now()) returning * into run_record;
  return jsonb_build_object('reconciliation_run_id', run_record.id, 'idempotent', false);
end;
$$;

create or replace function public.get_payment_reconciliation_execution_context(requested_reconciliation_run_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare run_record public.payment_reconciliation_runs;
begin
  select * into run_record from public.payment_reconciliation_runs run
  where run.id = requested_reconciliation_run_id and run.state = 'running' for update;
  if run_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'run_id', run_record.id,
    'payment_intents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', intent.id, 'provider_payment_reference', intent.provider_payment_reference,
        'state', intent.state, 'gross_amount_minor', intent.gross_amount_minor, 'currency', intent.currency
      ) order by intent.updated_at asc)
      from (
        select * from public.payment_intents
        where provider_configuration_id = run_record.provider_configuration_id
          and provider_payment_reference is not null
          and state in ('checkout_created', 'payment_processing', 'funded', 'on_hold', 'disputed', 'requires_action')
        order by updated_at asc limit 100
      ) intent
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_payment_reconciliation_item(
  requested_reconciliation_run_id uuid,
  requested_payment_intent_id uuid,
  requested_state public.payment_reconciliation_state,
  requested_reason_code text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare run_record public.payment_reconciliation_runs; item_record public.payment_reconciliation_items;
begin
  if requested_state not in ('matched', 'mismatched', 'missing', 'duplicate', 'unexplained')
    or char_length(trim(coalesce(requested_reason_code, ''))) not between 3 and 120 then raise exception 'VALIDATION_FAILED'; end if;
  select * into run_record from public.payment_reconciliation_runs run
  where run.id = requested_reconciliation_run_id and run.state = 'running' for update;
  if run_record.id is null or (requested_payment_intent_id is not null and not exists (
    select 1 from public.payment_intents intent where intent.id = requested_payment_intent_id and intent.provider_configuration_id = run_record.provider_configuration_id
  )) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.payment_reconciliation_items (reconciliation_run_id, payment_intent_id, state, reason_code)
  values (run_record.id, requested_payment_intent_id, requested_state, trim(requested_reason_code))
  returning * into item_record;
  return jsonb_build_object('reconciliation_item_id', item_record.id);
end;
$$;

create or replace function public.complete_payment_reconciliation_run(
  requested_reconciliation_run_id uuid,
  requested_failure_code text default null
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare run_record public.payment_reconciliation_runs;
begin
  if requested_failure_code is not null and char_length(trim(requested_failure_code)) > 120 then raise exception 'VALIDATION_FAILED'; end if;
  select * into run_record from public.payment_reconciliation_runs run where run.id = requested_reconciliation_run_id for update;
  if run_record.id is null or run_record.state <> 'running' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.payment_reconciliation_runs set state = case when requested_failure_code is null then 'completed' else 'failed' end,
    completed_at = now(), failure_code = nullif(trim(coalesce(requested_failure_code, '')), ''), updated_at = now()
  where id = run_record.id returning * into run_record;
  return jsonb_build_object('reconciliation_run_id', run_record.id, 'state', run_record.state);
end;
$$;

revoke all on function public.start_payment_reconciliation_run(uuid), public.get_payment_reconciliation_execution_context(uuid),
  public.record_payment_reconciliation_item(uuid, uuid, public.payment_reconciliation_state, text),
  public.complete_payment_reconciliation_run(uuid, text) from public, anon;
grant execute on function public.start_payment_reconciliation_run(uuid) to authenticated;
grant execute on function public.get_payment_reconciliation_execution_context(uuid),
  public.record_payment_reconciliation_item(uuid, uuid, public.payment_reconciliation_state, text),
  public.complete_payment_reconciliation_run(uuid, text) to service_role;
