-- Phase 34 — Financial privacy hardening and participant-scoped read models.

drop policy if exists "participants can read payment intents" on public.payment_intents;
drop policy if exists "participants can read payment releases" on public.payment_releases;
drop policy if exists "participants can read payment refunds" on public.payment_refunds;
drop policy if exists "participants can read payment disputes" on public.payment_disputes;
drop policy if exists "participants can read payment ledger" on public.payment_ledger_entries;
drop policy if exists "participants can read payment receipts" on public.payment_receipts;
drop policy if exists "participants and administrators can read payment events" on public.payment_events;

create policy "financial parties can read payment intents"
  on public.payment_intents for select to authenticated
  using (private.payment_active_billing_context(organization_id) or private.payment_active_talent_context((select engagement.talent_user_id from public.engagements engagement where engagement.id = engagement_id)));
create policy "financial parties can read payment releases"
  on public.payment_releases for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.payment_active_talent_context((select engagement.talent_user_id from public.engagements engagement where engagement.id = engagement_id)));
create policy "financial parties can read payment refunds"
  on public.payment_refunds for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.payment_active_talent_context((select engagement.talent_user_id from public.engagements engagement where engagement.id = engagement_id)));
create policy "financial parties can read payment disputes"
  on public.payment_disputes for select to authenticated
  using (private.payment_active_billing_context((select intent.organization_id from public.payment_intents intent where intent.id = payment_intent_id)) or private.payment_active_talent_context((select engagement.talent_user_id from public.engagements engagement where engagement.id = engagement_id)));
create policy "financial parties can read payment ledger"
  on public.payment_ledger_entries for select to authenticated
  using (payment_intent_id is not null and exists (
    select 1 from public.payment_intents intent
    join public.engagements engagement on engagement.id = intent.engagement_id
    where intent.id = payment_intent_id
      and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(engagement.talent_user_id))
  ));
create policy "financial parties can read payment receipts"
  on public.payment_receipts for select to authenticated
  using (
    (payment_intent_id is not null and exists (
      select 1 from public.payment_intents intent
      join public.engagements engagement on engagement.id = intent.engagement_id
      where intent.id = payment_intent_id
        and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(engagement.talent_user_id))
    ))
    or (payment_release_id is not null and exists (
      select 1 from public.payment_releases release
      join public.payment_intents intent on intent.id = release.payment_intent_id
      join public.engagements engagement on engagement.id = release.engagement_id
      where release.id = payment_release_id
        and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(engagement.talent_user_id))
    ))
    or (payout_id is not null and exists (
      select 1 from public.payouts payout
      where payout.id = payout_id and private.payment_active_talent_context(payout.talent_user_id)
    ))
    or (refund_id is not null and exists (
      select 1 from public.payment_refunds refund
      join public.payment_intents intent on intent.id = refund.payment_intent_id
      join public.engagements engagement on engagement.id = refund.engagement_id
      where refund.id = refund_id
        and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(engagement.talent_user_id))
    ))
  );
create policy "financial parties and administrators can read payment events"
  on public.payment_events for select to authenticated
  using (
    private.payment_active_admin_context()
    or (payment_intent_id is not null and exists (
      select 1 from public.payment_intents intent
      join public.engagements engagement on engagement.id = intent.engagement_id
      where intent.id = payment_intent_id
        and (private.payment_active_billing_context(intent.organization_id) or private.payment_active_talent_context(engagement.talent_user_id))
    ))
  );

create or replace function private.require_payment_financial_party(requested_engagement_id uuid)
returns public.engagements language plpgsql security definer stable set search_path = public, private as $$
declare result public.engagements;
begin
  select * into result from public.engagements engagement
  where engagement.id = requested_engagement_id
    and (private.payment_active_billing_context(engagement.organization_id) or private.payment_active_talent_context(engagement.talent_user_id));
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function public.get_engagement_payment_status(requested_engagement_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare engagement_record public.engagements; payment_record public.payment_intents; is_billing boolean;
begin
  engagement_record := private.require_payment_financial_party(requested_engagement_id);
  is_billing := private.payment_active_billing_context(engagement_record.organization_id);
  select * into payment_record from public.payment_intents intent
  where intent.engagement_id = engagement_record.id
  order by intent.created_at desc limit 1;
  return jsonb_build_object(
    'engagement_id', engagement_record.id,
    'is_billing_party', is_billing,
    'market_payment_available', exists (
      select 1 from public.payment_market_compliance_policies compliance
      where compliance.market_code = engagement_record.market_code
        and compliance.currency = engagement_record.currency
        and compliance.state = 'approved'
    ),
    'funding_state', engagement_record.funding_state,
    'payment_intent', case when payment_record.id is null then null else jsonb_build_object(
      'id', payment_record.id, 'state', payment_record.state,
      'gross_amount_minor', payment_record.gross_amount_minor,
      'platform_fee_minor', payment_record.platform_fee_minor,
      'provider_fee_minor', payment_record.provider_fee_minor,
      'tax_amount_minor', payment_record.tax_amount_minor,
      'funding_total_minor', payment_record.funding_total_minor,
      'expected_talent_net_minor', payment_record.expected_talent_net_minor,
      'currency', payment_record.currency,
      'checkout_expires_at', payment_record.provider_checkout_expires_at,
      'funded_at', payment_record.funded_at
    ) end,
    'releases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', release.id, 'milestone_id', release.milestone_id, 'state', release.state,
        'gross_amount_minor', release.gross_amount_minor,
        'provider_fee_minor', release.provider_fee_minor,
        'tax_withholding_minor', release.tax_withholding_minor,
        'expected_talent_net_minor', release.expected_talent_net_minor,
        'currency', release.currency, 'released_at', release.released_at
      ) order by release.created_at desc)
      from public.payment_releases release where release.engagement_id = engagement_record.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', refund.id, 'state', refund.state, 'amount_minor', refund.amount_minor,
        'currency', refund.currency, 'requested_at', refund.created_at, 'refunded_at', refund.refunded_at
      ) order by refund.created_at desc)
      from public.payment_refunds refund where refund.engagement_id = engagement_record.id
    ), '[]'::jsonb),
    'dispute_hold', exists (
      select 1 from public.payment_disputes dispute
      where dispute.engagement_id = engagement_record.id and dispute.state in ('open', 'under_review')
    ),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', receipt.id, 'type', receipt.receipt_type, 'status_label', receipt.status_label,
        'amount_minor', receipt.amount_minor, 'currency', receipt.currency, 'issued_at', receipt.issued_at
      ) order by receipt.issued_at desc)
      from public.payment_receipts receipt
      where receipt.payment_intent_id = payment_record.id
        or receipt.payment_release_id in (select release.id from public.payment_releases release where release.engagement_id = engagement_record.id)
        or receipt.refund_id in (select refund.id from public.payment_refunds refund where refund.engagement_id = engagement_record.id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_active_company_billing_overview()
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare active_organization_id uuid; profile_record public.company_billing_profiles;
begin
  select context.active_organization_id into active_organization_id from public.active_contexts context
  where context.user_id = auth.uid() and context.active_role = 'company_member' limit 1;
  if active_organization_id is null or not private.payment_active_billing_context(active_organization_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into profile_record from public.company_billing_profiles profile where profile.organization_id = active_organization_id;
  return jsonb_build_object(
    'organization_id', active_organization_id,
    'billing_profile', case when profile_record.id is null then null else jsonb_build_object(
      'id', profile_record.id, 'status', profile_record.status,
      'is_authorized_payer', profile_record.authorized_payer_user_id = auth.uid(),
      'policy_acknowledged_at', profile_record.policy_acknowledged_at
    ) end,
    'spend_controls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', control.currency, 'state', control.state,
        'per_payment_limit_minor', control.per_payment_limit_minor,
        'period_limit_minor', control.period_limit_minor,
        'period_starts_at', control.period_starts_at, 'period_ends_at', control.period_ends_at
      ) order by control.period_ends_at desc)
      from public.company_spend_controls control
      where control.organization_id = active_organization_id and control.state = 'active'
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', intent.id, 'engagement_id', intent.engagement_id, 'state', intent.state,
        'funding_total_minor', intent.funding_total_minor, 'currency', intent.currency,
        'created_at', intent.created_at, 'funded_at', intent.funded_at
      ) order by intent.created_at desc)
      from (
        select * from public.payment_intents
        where organization_id = active_organization_id
        order by created_at desc limit 50
      ) intent
    ), '[]'::jsonb),
    'sandbox_mode_only', true
  );
end;
$$;

create or replace function public.get_private_payout_status()
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not private.payment_active_talent_context(actor_id) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'payout_accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', account.id, 'state', account.state, 'requirements_status_code', account.requirements_status_code,
        'last_verified_at', account.last_verified_at
      ) order by account.updated_at desc)
      from public.payout_accounts account where account.talent_user_id = actor_id
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', payout.id, 'state', payout.state, 'amount_minor', payout.amount_minor,
        'currency', payout.currency, 'paid_at', payout.paid_at, 'created_at', payout.created_at
      ) order by payout.created_at desc)
      from (
        select * from public.payouts
        where talent_user_id = actor_id
        order by created_at desc limit 50
      ) payout
    ), '[]'::jsonb),
    'sandbox_mode_only', true,
    'payout_destination_disclosure', 'Payout destination details stay with the payment provider and are not stored in Proofly.'
  );
end;
$$;

create or replace function public.get_payment_reconciliation_queue()
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
begin
  if not private.payment_active_admin_context() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return jsonb_build_object(
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', run.id, 'state', run.state, 'created_at', run.created_at,
        'started_at', run.started_at, 'completed_at', run.completed_at
      ) order by run.created_at desc)
      from (select * from public.payment_reconciliation_runs order by created_at desc limit 50) run
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id, 'run_id', item.reconciliation_run_id, 'state', item.state,
        'reason_code', item.reason_code, 'created_at', item.created_at, 'resolved_at', item.resolved_at
      ) order by item.created_at asc)
      from (
        select * from public.payment_reconciliation_items
        where state in ('pending', 'mismatched', 'missing', 'duplicate', 'unexplained')
        order by created_at asc limit 100
      ) item
    ), '[]'::jsonb),
    'dead_letters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'event_type', event.provider_event_type, 'normalized_event_type', event.normalized_event_type,
        'failure_code', event.failure_code, 'received_at', event.received_at, 'retry_count', event.retry_count
      ) order by event.received_at asc)
      from (
        select * from public.payment_provider_events
        where state = 'dead_letter'
        order by received_at asc limit 100
      ) event
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function private.require_payment_financial_party(uuid) from public, anon, authenticated;
revoke all on function public.get_engagement_payment_status(uuid), public.get_active_company_billing_overview(),
  public.get_private_payout_status(), public.get_payment_reconciliation_queue() from public, anon;
grant execute on function public.get_engagement_payment_status(uuid), public.get_active_company_billing_overview(),
  public.get_private_payout_status(), public.get_payment_reconciliation_queue() to authenticated;
