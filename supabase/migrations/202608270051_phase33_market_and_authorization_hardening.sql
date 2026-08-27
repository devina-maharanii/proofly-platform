-- Phase 33 hardening — company-origin proposals and guarded market readiness.
-- A paid engagement cannot be drafted by Talent or enabled from unapproved market/payment policy data.

create or replace function public.create_engagement_draft(
  requested_application_id uuid,
  requested_engagement_type public.engagement_type,
  requested_market_code text,
  requested_currency text,
  requested_parent_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare application_record public.project_applications; parent_record public.engagements; result public.engagements;
begin
  if requested_idempotency_key is null
    or upper(trim(coalesce(requested_market_code, ''))) !~ '^[A-Z]{2,8}$'
    or upper(trim(coalesce(requested_currency, ''))) !~ '^[A-Z]{3}$'
  then raise exception 'VALIDATION_FAILED'; end if;
  application_record := private.engagement_application_for_actor(requested_application_id);
  if not private.engagement_company_context(application_record.organization_id, 'hiring_member') then
    raise exception 'NOT_FOUND_OR_PRIVATE';
  end if;
  if requested_engagement_type = 'ongoing_contract' then
    select * into parent_record from public.engagements parent
    where parent.id = requested_parent_engagement_id
      and parent.application_id = application_record.id
      and parent.engagement_type = 'paid_trial'
      and parent.state = 'completed';
    if parent_record.id is null then raise exception 'INVALID_STATE'; end if;
  elsif requested_parent_engagement_id is not null then
    raise exception 'VALIDATION_FAILED';
  end if;
  select engagement.* into result from public.engagements engagement
  join public.engagement_events event on event.engagement_id = engagement.id
  where event.actor_user_id = auth.uid()
    and event.event_type = 'engagement.draft_created'
    and event.idempotency_key = requested_idempotency_key
  order by event.occurred_at desc limit 1;
  if result.id is not null then
    return jsonb_build_object('engagement_id', result.id, 'state', result.state, 'idempotent', true);
  end if;
  insert into public.engagements (
    organization_id, project_id, application_id, parent_engagement_id, engagement_type,
    market_code, currency, talent_user_id, created_by_user_id
  ) values (
    application_record.organization_id, application_record.project_id, application_record.id,
    requested_parent_engagement_id, requested_engagement_type,
    upper(trim(requested_market_code)), upper(trim(requested_currency)),
    application_record.talent_user_id, auth.uid()
  ) returning * into result;
  perform private.append_engagement_event(
    result.id, null, null, null, 'engagement.draft_created', null, 'draft',
    requested_idempotency_key,
    jsonb_build_object('engagement_type', result.engagement_type, 'market_code', result.market_code, 'currency', result.currency)
  );
  return jsonb_build_object('engagement_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.get_engagement_market_options()
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
begin
  if auth.uid() is null
    or not exists (select 1 from public.active_contexts context where context.user_id = auth.uid() and context.active_role = 'company_member')
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'market_code', policy.market_code,
      'currency', policy.currency,
      'state', policy.state,
      'limitation_notice', policy.limitation_notice,
      'support_route', policy.support_route,
      'terms_version_label', policy.terms_version_label
    ) order by policy.market_code, policy.currency)
    from public.engagement_market_policies policy
    where policy.state in ('approved', 'limited') and policy.provider_capability_confirmed
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.create_engagement_draft(uuid, public.engagement_type, text, text, uuid, uuid), public.get_engagement_market_options() from public, anon;
grant execute on function public.create_engagement_draft(uuid, public.engagement_type, text, text, uuid, uuid), public.get_engagement_market_options() to authenticated;
