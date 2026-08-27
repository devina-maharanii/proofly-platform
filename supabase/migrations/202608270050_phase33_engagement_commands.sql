-- Phase 33 — Engagement commands and private readers.
-- Payment execution is intentionally absent. Funding can change only through a future verified provider boundary.

alter table public.project_application_events drop constraint if exists project_application_events_event_type_check;
alter table public.project_application_events add constraint project_application_events_event_type_check check (event_type in (
  'application.draft_created', 'application.draft_saved', 'application.submitted', 'application.withdrawn',
  'application.trial_invited', 'application.accepted'
));

alter table public.engagements
  drop constraint if exists engagements_check,
  drop constraint if exists engagements_check1,
  drop constraint if exists engagements_check2,
  drop constraint if exists engagements_check3,
  drop constraint if exists engagements_check4,
  drop constraint if exists engagements_check5,
  drop constraint if exists engagements_check6;
alter table public.engagements
  add constraint engagements_accepted_history_check check (
    state not in ('accepted', 'funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'terminated', 'disputed', 'resolved', 'refunded')
    or accepted_at is not null
  ),
  add constraint engagements_funded_history_check check (
    state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'terminated', 'refunded')
    or funded_at is not null
  ),
  add constraint engagements_started_history_check check (
    state not in ('in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed', 'terminated', 'refunded')
    or started_at is not null
  ),
  add constraint engagements_completed_history_check check (
    state <> 'completed' or completed_at is not null
  ),
  add constraint engagements_terminated_history_check check (
    state <> 'terminated' or terminated_at is not null
  ),
  add constraint engagements_cancelled_history_check check (
    state <> 'cancelled_before_start' or cancelled_at is not null
  ),
  add constraint engagements_dispute_history_check check (
    state not in ('disputed', 'resolved') or disputed_at is not null
  );

alter table public.engagement_terms_versions
  drop constraint if exists engagement_terms_versions_check,
  drop constraint if exists engagement_terms_versions_check1,
  drop constraint if exists engagement_terms_versions_check2;
alter table public.engagement_terms_versions
  add constraint engagement_terms_versions_proposal_history_check check (
    state not in ('proposed', 'accepted', 'superseded', 'declined', 'expired', 'withdrawn') or proposed_at is not null
  ),
  add constraint engagement_terms_versions_acceptance_check check (
    state <> 'accepted' or accepted_at is not null
  ),
  add constraint engagement_terms_versions_superseded_check check (
    state <> 'superseded' or superseded_at is not null
  );

create unique index engagement_disputes_open_per_party_idx
  on public.engagement_disputes(engagement_id, coalesce(milestone_id, '00000000-0000-0000-0000-000000000000'::uuid), opened_by_user_id)
  where state in ('open', 'under_review');

alter table public.engagement_change_orders
  add column idempotency_key uuid not null default gen_random_uuid();
create unique index engagement_change_orders_idempotency_idx
  on public.engagement_change_orders(engagement_id, proposed_by_user_id, idempotency_key);

create or replace function private.engagement_application_for_actor(requested_application_id uuid)
returns public.project_applications language plpgsql security definer stable set search_path = public as $$
declare result public.project_applications;
begin
  select * into result from public.project_applications application
  where application.id = requested_application_id
    and application.state in ('shortlisted', 'invited_to_trial', 'accepted')
    and (
      (application.talent_user_id = auth.uid() and private.engagement_talent_context(auth.uid()))
      or private.engagement_company_context(application.organization_id, 'hiring_member')
    );
  if result.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return result;
end;
$$;

create or replace function private.engagement_transition_allowed(
  current_state public.engagement_state,
  requested_state public.engagement_state
) returns boolean language sql immutable set search_path = pg_catalog as $$
  select (current_state = 'draft' and requested_state in ('proposed', 'cancelled_before_start'))
    or (current_state = 'proposed' and requested_state in ('negotiating', 'accepted', 'declined', 'expired', 'cancelled_before_start'))
    or (current_state = 'negotiating' and requested_state in ('proposed', 'declined', 'cancelled_before_start'))
    or (current_state = 'accepted' and requested_state in ('funding_required', 'cancelled_before_start'))
    or (current_state = 'funding_required' and requested_state in ('funded', 'cancelled_before_start', 'disputed'))
    or (current_state = 'funded' and requested_state in ('in_progress', 'cancelled_before_start', 'disputed'))
    or (current_state = 'in_progress' and requested_state in ('submitted', 'terminated', 'disputed'))
    or (current_state = 'submitted' and requested_state in ('changes_requested', 'accepted_for_payment', 'terminated', 'disputed'))
    or (current_state = 'changes_requested' and requested_state in ('in_progress', 'submitted', 'terminated', 'disputed'))
    or (current_state = 'accepted_for_payment' and requested_state in ('completed', 'terminated', 'disputed'))
    or (current_state = 'completed' and requested_state in ('disputed', 'resolved'))
    or (current_state = 'disputed' and requested_state in ('resolved', 'terminated'))
$$;

create or replace function private.engagement_set_state(
  target_engagement public.engagements,
  target_state public.engagement_state,
  target_terms_version_id uuid,
  target_event_type text,
  target_idempotency_key uuid,
  target_metadata jsonb default '{}'::jsonb
) returns public.engagements language plpgsql security definer set search_path = public, private as $$
declare result public.engagements;
begin
  if target_engagement.state = target_state then return target_engagement; end if;
  if not private.engagement_transition_allowed(target_engagement.state, target_state) then raise exception 'INVALID_STATE'; end if;
  update public.engagements set
    state = target_state,
    accepted_at = case when target_state = 'accepted' then now() else accepted_at end,
    funded_at = case when target_state = 'funded' then now() else funded_at end,
    started_at = case when target_state = 'in_progress' then coalesce(started_at, now()) else started_at end,
    completed_at = case when target_state = 'completed' then now() else completed_at end,
    terminated_at = case when target_state = 'terminated' then now() else terminated_at end,
    cancelled_at = case when target_state = 'cancelled_before_start' then now() else cancelled_at end,
    disputed_at = case when target_state = 'disputed' then now() else disputed_at end,
    updated_at = now()
  where id = target_engagement.id returning * into result;
  perform private.append_engagement_event(result.id, target_terms_version_id, null, null, target_event_type, target_engagement.state, target_state, target_idempotency_key, target_metadata);
  return result;
end;
$$;

create or replace function private.engagement_materialize_milestones(
  target_engagement public.engagements,
  target_terms public.engagement_terms_versions
) returns void language plpgsql security definer set search_path = public, private as $$
declare item jsonb; item_index integer := 0; task_ids uuid[];
begin
  if exists (select 1 from public.engagement_milestones milestone where milestone.engagement_id = target_engagement.id and milestone.terms_version_id = target_terms.id) then return; end if;
  for item in select value from jsonb_array_elements(target_terms.terms_snapshot->'milestones') loop
    select coalesce(array_agg((value #>> '{}')::uuid), '{}'::uuid[]) into task_ids
    from jsonb_array_elements(coalesce(item->'linked_task_ids', '[]'::jsonb));
    if cardinality(task_ids) > 0 and (
      target_engagement.workspace_id is null
      or exists (
        select 1 from unnest(task_ids) task_id
        where not exists (
          select 1 from public.project_workspace_tasks task
          where task.id = task_id and task.workspace_id = target_engagement.workspace_id
        )
      )
    ) then raise exception 'VALIDATION_FAILED'; end if;
    insert into public.engagement_milestones (
      engagement_id, terms_version_id, milestone_index, title, description, deliverable_type,
      definition_of_done, due_date, amount_minor, currency, revision_allowance, approver_role,
      timeout_policy, evidence_policy, linked_task_ids, state
    ) values (
      target_engagement.id, target_terms.id, item_index, trim(item->>'title'), trim(item->>'description'),
      trim(item->>'deliverable_type'), trim(item->>'definition_of_done'), (item->>'due_date')::date,
      (item->>'amount_minor')::bigint, item->>'currency', (item->>'revision_allowance')::integer,
      'company', trim(item->>'timeout_policy'), trim(item->>'evidence_policy'), task_ids, 'pending_funding'
    );
    item_index := item_index + 1;
  end loop;
end;
$$;

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
  if requested_idempotency_key is null or upper(trim(coalesce(requested_market_code, ''))) !~ '^[A-Z]{2,8}$' or upper(trim(coalesce(requested_currency, ''))) !~ '^[A-Z]{3}$' then raise exception 'VALIDATION_FAILED'; end if;
  application_record := private.engagement_application_for_actor(requested_application_id);
  if requested_engagement_type = 'ongoing_contract' then
    select * into parent_record from public.engagements parent
    where parent.id = requested_parent_engagement_id and parent.application_id = application_record.id
      and parent.engagement_type = 'paid_trial' and parent.state = 'completed';
    if parent_record.id is null then raise exception 'INVALID_STATE'; end if;
  elsif requested_parent_engagement_id is not null then
    raise exception 'VALIDATION_FAILED';
  end if;
  if exists (
    select 1 from public.engagement_events event
    where event.actor_user_id = auth.uid() and event.event_type = 'engagement.draft_created'
      and event.idempotency_key = requested_idempotency_key
  ) then
    select engagement.* into result from public.engagements engagement
    join public.engagement_events event on event.engagement_id = engagement.id
    where event.actor_user_id = auth.uid() and event.event_type = 'engagement.draft_created'
      and event.idempotency_key = requested_idempotency_key order by event.occurred_at desc limit 1;
    return jsonb_build_object('engagement_id', result.id, 'state', result.state, 'idempotent', true);
  end if;
  insert into public.engagements (
    organization_id, project_id, application_id, parent_engagement_id, engagement_type,
    market_code, currency, talent_user_id, created_by_user_id
  ) values (
    application_record.organization_id, application_record.project_id, application_record.id,
    requested_parent_engagement_id, requested_engagement_type, upper(trim(requested_market_code)),
    upper(trim(requested_currency)), application_record.talent_user_id, auth.uid()
  ) returning * into result;
  perform private.append_engagement_event(result.id, null, null, null, 'engagement.draft_created', null, 'draft', requested_idempotency_key,
    jsonb_build_object('engagement_type', result.engagement_type, 'market_code', result.market_code, 'currency', result.currency));
  return jsonb_build_object('engagement_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.save_engagement_terms_draft(
  requested_engagement_id uuid,
  requested_terms jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; terms_record public.engagement_terms_versions; next_version integer;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if private.engagement_actor_role(engagement_record.id) <> 'company' or engagement_record.state not in ('draft', 'negotiating')
    or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, requested_terms)
    or upper(requested_terms->>'market_code') <> engagement_record.market_code
    or requested_terms->>'currency' <> engagement_record.currency
    or (requested_terms->>'start_date')::date > (requested_terms->>'deadline')::date
    or not private.engagement_market_is_supported(engagement_record.market_code, engagement_record.currency)
  then raise exception 'VALIDATION_FAILED'; end if;
  select * into terms_record from public.engagement_terms_versions where id = engagement_record.current_terms_version_id for update;
  if terms_record.id is not null and terms_record.state = 'draft' then
    update public.engagement_terms_versions set terms_snapshot = requested_terms, updated_at = now()
    where id = terms_record.id returning * into terms_record;
  else
    select coalesce(max(version_number), 0) + 1 into next_version from public.engagement_terms_versions where engagement_id = engagement_record.id;
    insert into public.engagement_terms_versions (engagement_id, version_number, terms_snapshot, created_by_user_id)
    values (engagement_record.id, next_version, requested_terms, auth.uid()) returning * into terms_record;
    update public.engagements set current_terms_version_id = terms_record.id, updated_at = now() where id = engagement_record.id;
  end if;
  perform private.append_engagement_event(engagement_record.id, terms_record.id, null, null, 'engagement.draft_saved', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('terms_version', terms_record.version_number));
  return jsonb_build_object('engagement_id', engagement_record.id, 'terms_version_id', terms_record.id, 'version', terms_record.version_number, 'state', terms_record.state);
end;
$$;

create or replace function public.propose_engagement_terms(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; terms_record public.engagement_terms_versions; application_record public.project_applications;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  if exists (
    select 1 from public.engagement_events event
    where event.engagement_id = engagement_record.id
      and event.actor_user_id = auth.uid()
      and event.event_type = 'engagement.terms_proposed'
      and event.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('engagement_id', engagement_record.id, 'terms_version_id', engagement_record.current_terms_version_id, 'state', engagement_record.state, 'idempotent', true);
  end if;
  select * into terms_record from public.engagement_terms_versions where id = engagement_record.current_terms_version_id for update;
  if terms_record.id is null or terms_record.state <> 'draft' or engagement_record.state not in ('draft', 'negotiating')
    or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, terms_record.terms_snapshot)
    or not private.engagement_market_is_supported(engagement_record.market_code, engagement_record.currency)
    or (select coalesce(sum((item->>'amount_minor')::bigint), 0) from jsonb_array_elements(terms_record.terms_snapshot->'milestones') item) <> (terms_record.terms_snapshot->>'compensation_amount_minor')::bigint
  then raise exception 'VALIDATION_FAILED'; end if;
  update public.engagement_terms_versions set state = 'proposed', proposed_at = now(), updated_at = now() where id = terms_record.id returning * into terms_record;
  insert into public.engagement_terms_acceptances (engagement_id, terms_version_id, participant_role, accepted_by_user_id, idempotency_key)
  values (engagement_record.id, terms_record.id, 'company', auth.uid(), requested_idempotency_key)
  on conflict (terms_version_id, participant_role) do nothing;
  if engagement_record.state = 'draft' then
    engagement_record := private.engagement_set_state(engagement_record, 'proposed', terms_record.id, 'engagement.terms_proposed', requested_idempotency_key,
      jsonb_build_object('terms_version', terms_record.version_number, 'expires_at', engagement_record.proposal_expires_at));
  else
    engagement_record := private.engagement_set_state(engagement_record, 'proposed', terms_record.id, 'engagement.terms_proposed', requested_idempotency_key,
      jsonb_build_object('terms_version', terms_record.version_number));
  end if;
  update public.engagements
  set proposal_expires_at = now() + interval '14 days', updated_at = now()
  where id = engagement_record.id
  returning * into engagement_record;
  if engagement_record.engagement_type = 'paid_trial' then
    select * into application_record from public.project_applications where id = engagement_record.application_id for update;
    if application_record.id is null or application_record.state not in ('shortlisted', 'invited_to_trial') then raise exception 'INVALID_STATE'; end if;
    if application_record.state = 'shortlisted' then
      update public.project_applications set state = 'invited_to_trial', updated_at = now() where id = application_record.id;
      insert into public.project_application_events (application_id, organization_id, actor_user_id, event_type, previous_state, next_state)
      values (application_record.id, application_record.organization_id, auth.uid(), 'application.trial_invited', 'shortlisted', 'invited_to_trial');
    end if;
  end if;
  return jsonb_build_object('engagement_id', engagement_record.id, 'terms_version_id', terms_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.record_engagement_negotiation_entry(
  requested_engagement_id uuid,
  requested_entry_type text,
  requested_body text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; terms_record public.engagement_terms_versions; entry_record public.engagement_negotiation_entries;
begin
  if requested_idempotency_key is null or requested_entry_type not in ('question', 'change_requested', 'response', 'declined')
    or char_length(trim(coalesce(requested_body, ''))) not between 10 and 1600
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  select * into entry_record from public.engagement_negotiation_entries where engagement_id = engagement_record.id and actor_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if entry_record.id is not null then return jsonb_build_object('entry_id', entry_record.id, 'idempotent', true); end if;
  select * into terms_record from public.engagement_terms_versions where id = engagement_record.current_terms_version_id for update;
  if terms_record.id is null or terms_record.state <> 'proposed' or engagement_record.state not in ('proposed', 'negotiating')
    or engagement_record.proposal_expires_at is null or engagement_record.proposal_expires_at <= now()
  then raise exception 'INVALID_STATE'; end if;
  insert into public.engagement_negotiation_entries (engagement_id, terms_version_id, actor_user_id, entry_type, body, idempotency_key)
  values (engagement_record.id, terms_record.id, auth.uid(), requested_entry_type, trim(requested_body), requested_idempotency_key) returning * into entry_record;
  if requested_entry_type = 'declined' then
    update public.engagement_terms_versions set state = 'declined', updated_at = now() where id = terms_record.id;
    engagement_record := private.engagement_set_state(engagement_record, 'declined', terms_record.id, 'engagement.declined', requested_idempotency_key, '{}'::jsonb);
  elsif engagement_record.state = 'proposed' then
    engagement_record := private.engagement_set_state(engagement_record, 'negotiating', terms_record.id, 'engagement.negotiation_recorded', requested_idempotency_key,
      jsonb_build_object('entry_type', requested_entry_type));
  else
    perform private.append_engagement_event(engagement_record.id, terms_record.id, null, null, 'engagement.negotiation_recorded', engagement_record.state, engagement_record.state, requested_idempotency_key,
      jsonb_build_object('entry_type', requested_entry_type));
  end if;
  return jsonb_build_object('entry_id', entry_record.id, 'state', engagement_record.state, 'idempotent', false);
end;
$$;

create or replace function public.create_engagement_terms_revision(
  requested_engagement_id uuid,
  requested_terms jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; prior_terms public.engagement_terms_versions; replacement public.engagement_terms_versions; next_version integer;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  select * into prior_terms from public.engagement_terms_versions where id = engagement_record.current_terms_version_id for update;
  if prior_terms.id is null or prior_terms.state <> 'proposed' or engagement_record.state not in ('proposed', 'negotiating')
    or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, requested_terms)
    or upper(requested_terms->>'market_code') <> engagement_record.market_code or requested_terms->>'currency' <> engagement_record.currency
    or not private.engagement_market_is_supported(engagement_record.market_code, engagement_record.currency)
  then raise exception 'VALIDATION_FAILED'; end if;
  if prior_terms.terms_snapshot = requested_terms then raise exception 'VALIDATION_FAILED'; end if;
  update public.engagement_terms_versions set state = 'superseded', superseded_at = now(), updated_at = now() where id = prior_terms.id;
  select max(version_number) + 1 into next_version from public.engagement_terms_versions where engagement_id = engagement_record.id;
  insert into public.engagement_terms_versions (engagement_id, version_number, terms_snapshot, created_by_user_id)
  values (engagement_record.id, next_version, requested_terms, auth.uid()) returning * into replacement;
  update public.engagements set current_terms_version_id = replacement.id, updated_at = now() where id = engagement_record.id;
  perform private.append_engagement_event(engagement_record.id, replacement.id, null, null, 'engagement.draft_saved', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('terms_version', replacement.version_number, 'replaces_version', prior_terms.version_number));
  return jsonb_build_object('terms_version_id', replacement.id, 'version', replacement.version_number, 'state', replacement.state);
end;
$$;

create or replace function public.accept_engagement_terms(
  requested_engagement_id uuid,
  requested_terms_version_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; terms_record public.engagement_terms_versions; application_record public.project_applications;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if private.engagement_actor_role(engagement_record.id) <> 'talent' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if exists (
    select 1 from public.engagement_terms_acceptances acceptance
    where acceptance.engagement_id = engagement_record.id
      and acceptance.accepted_by_user_id = auth.uid()
      and acceptance.idempotency_key = requested_idempotency_key
  ) then
    return jsonb_build_object('engagement_id', engagement_record.id, 'terms_version_id', engagement_record.current_terms_version_id, 'state', engagement_record.state, 'idempotent', true);
  end if;
  select * into terms_record from public.engagement_terms_versions where id = requested_terms_version_id and engagement_id = engagement_record.id for update;
  if terms_record.id is null or terms_record.id <> engagement_record.current_terms_version_id or terms_record.state <> 'proposed' or engagement_record.state <> 'proposed'
    or engagement_record.proposal_expires_at is null or engagement_record.proposal_expires_at <= now()
  then raise exception 'INVALID_STATE'; end if;
  if not exists (select 1 from public.engagement_terms_acceptances acceptance where acceptance.terms_version_id = terms_record.id and acceptance.participant_role = 'company') then raise exception 'INVALID_STATE'; end if;
  insert into public.engagement_terms_acceptances (engagement_id, terms_version_id, participant_role, accepted_by_user_id, idempotency_key)
  values (engagement_record.id, terms_record.id, 'talent', auth.uid(), requested_idempotency_key)
  on conflict (terms_version_id, participant_role) do nothing;
  update public.engagement_terms_versions set state = 'accepted', accepted_at = now(), updated_at = now() where id = terms_record.id returning * into terms_record;
  engagement_record := private.engagement_set_state(engagement_record, 'accepted', terms_record.id, 'engagement.terms_accepted', requested_idempotency_key,
    jsonb_build_object('terms_version', terms_record.version_number));
  if engagement_record.engagement_type = 'paid_trial' then
    select * into application_record from public.project_applications where id = engagement_record.application_id for update;
    if application_record.id is null or application_record.state <> 'invited_to_trial' then raise exception 'INVALID_STATE'; end if;
    update public.project_applications set state = 'accepted', updated_at = now() where id = application_record.id;
    insert into public.project_application_events (application_id, organization_id, actor_user_id, event_type, previous_state, next_state)
    values (application_record.id, application_record.organization_id, auth.uid(), 'application.accepted', 'invited_to_trial', 'accepted');
  end if;
  return jsonb_build_object('engagement_id', engagement_record.id, 'terms_version_id', terms_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.require_engagement_funding(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  if engagement_record.state = 'funding_required' then return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true); end if;
  if engagement_record.state <> 'accepted' then raise exception 'INVALID_STATE'; end if;
  update public.engagements set funding_state = 'funding_required', updated_at = now() where id = engagement_record.id returning * into engagement_record;
  engagement_record := private.engagement_set_state(engagement_record, 'funding_required', engagement_record.current_terms_version_id, 'engagement.funding_required', requested_idempotency_key,
    jsonb_build_object('payment_execution', 'deferred_to_phase_34'));
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'funding_state', engagement_record.funding_state);
end;
$$;

create or replace function private.record_verified_engagement_funding(
  requested_engagement_id uuid,
  requested_provider_event_reference text,
  requested_provider_status public.engagement_funding_state
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  if requested_provider_status not in ('verified_funded', 'held', 'refunded', 'settled')
    or char_length(trim(coalesce(requested_provider_event_reference, ''))) not between 16 and 160 then raise exception 'VALIDATION_FAILED'; end if;
  select * into engagement_record from public.engagements where id = requested_engagement_id for update;
  if engagement_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.engagement_funding_events (engagement_id, provider_event_reference, provider_status)
  values (engagement_record.id, trim(requested_provider_event_reference), requested_provider_status)
  on conflict (provider_event_reference) do nothing;
  if requested_provider_status = 'verified_funded' and engagement_record.state = 'funding_required' then
    update public.engagements set funding_state = 'verified_funded', funded_at = now(), updated_at = now() where id = engagement_record.id returning * into engagement_record;
    engagement_record := private.engagement_set_state(engagement_record, 'funded', engagement_record.current_terms_version_id, 'engagement.funding_verified', null,
      jsonb_build_object('provider_reference_recorded', true));
    update public.engagement_milestones set state = 'funded', updated_at = now() where engagement_id = engagement_record.id and state = 'pending_funding';
  elsif requested_provider_status in ('held', 'refunded') then
    update public.engagements set funding_state = requested_provider_status, updated_at = now() where id = engagement_record.id;
  end if;
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'funding_state', engagement_record.funding_state);
end;
$$;

create or replace function public.expire_engagement_offer(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; terms_record public.engagement_terms_versions;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if engagement_record.state = 'expired' then
    return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true);
  end if;
  if engagement_record.state not in ('proposed', 'negotiating')
    or engagement_record.proposal_expires_at is null
    or engagement_record.proposal_expires_at > now()
  then raise exception 'INVALID_STATE'; end if;
  select * into terms_record from public.engagement_terms_versions
  where id = engagement_record.current_terms_version_id for update;
  if terms_record.id is null or terms_record.state <> 'proposed' then raise exception 'INVALID_STATE'; end if;
  update public.engagement_terms_versions
  set state = 'expired', updated_at = now()
  where id = terms_record.id;
  engagement_record := private.engagement_set_state(
    engagement_record, 'expired', terms_record.id, 'engagement.expired',
    requested_idempotency_key, '{}'::jsonb
  );
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', false);
end;
$$;

create or replace function public.link_engagement_workspace(
  requested_engagement_id uuid,
  requested_workspace_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; workspace_record public.project_workspaces; terms_record public.engagement_terms_versions;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  select * into workspace_record from public.project_workspaces workspace
  where workspace.id = requested_workspace_id and workspace.accepted_application_id = engagement_record.application_id
    and workspace.organization_id = engagement_record.organization_id for update;
  if workspace_record.id is null or engagement_record.state not in ('funded', 'in_progress') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if engagement_record.workspace_id is not null and engagement_record.workspace_id <> workspace_record.id then raise exception 'CONFLICT'; end if;
  update public.engagements set workspace_id = workspace_record.id, updated_at = now() where id = engagement_record.id returning * into engagement_record;
  select * into terms_record from public.engagement_terms_versions where id = engagement_record.current_terms_version_id;
  perform private.engagement_materialize_milestones(engagement_record, terms_record);
  perform private.append_engagement_event(engagement_record.id, terms_record.id, null, null, 'engagement.workspace_linked', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('workspace_linked', true));
  return jsonb_build_object('engagement_id', engagement_record.id, 'workspace_id', engagement_record.workspace_id, 'state', engagement_record.state);
end;
$$;

create or replace function public.start_engagement_work(
  requested_engagement_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  if engagement_record.state = 'in_progress' then return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true); end if;
  if engagement_record.state <> 'funded' or engagement_record.funding_state <> 'verified_funded' or engagement_record.workspace_id is null then raise exception 'INVALID_STATE'; end if;
  engagement_record := private.engagement_set_state(engagement_record, 'in_progress', engagement_record.current_terms_version_id, 'engagement.started', requested_idempotency_key, '{}'::jsonb);
  update public.engagement_milestones set state = 'in_progress', updated_at = now() where engagement_id = engagement_record.id and state = 'funded';
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.submit_engagement_milestone(
  requested_engagement_id uuid,
  requested_milestone_id uuid,
  requested_workspace_submission_version_id uuid,
  requested_summary text,
  requested_known_limitations text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; milestone_record public.engagement_milestones; submission_version public.project_workspace_submission_versions; submission_record public.project_workspace_submissions; result public.engagement_milestone_submissions; next_version integer;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_summary, ''))) not between 10 and 1000 or char_length(coalesce(requested_known_limitations, '')) > 1400 then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if private.engagement_actor_role(engagement_record.id) <> 'talent' or engagement_record.state not in ('in_progress', 'changes_requested') then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into milestone_record from public.engagement_milestones where id = requested_milestone_id and engagement_id = engagement_record.id for update;
  select * into submission_version from public.project_workspace_submission_versions where id = requested_workspace_submission_version_id;
  select * into submission_record from public.project_workspace_submissions where id = submission_version.submission_id;
  if milestone_record.id is null or milestone_record.state not in ('in_progress', 'changes_requested')
    or submission_version.id is null or submission_version.workspace_id <> engagement_record.workspace_id
    or submission_record.id is null or submission_record.talent_user_id <> auth.uid()
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into result from public.engagement_milestone_submissions where milestone_id = milestone_record.id and submitted_by_user_id = auth.uid() and created_at is not null
    and id in (select event.milestone_id from public.engagement_events event where event.engagement_id = engagement_record.id and event.actor_user_id = auth.uid() and event.event_type = 'milestone.submitted' and event.idempotency_key = requested_idempotency_key) limit 1;
  if result.id is not null then return jsonb_build_object('submission_id', result.id, 'idempotent', true); end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.engagement_milestone_submissions where milestone_id = milestone_record.id;
  insert into public.engagement_milestone_submissions (engagement_id, milestone_id, workspace_submission_version_id, version_number, submitted_by_user_id, summary, known_limitations)
  values (engagement_record.id, milestone_record.id, submission_version.id, next_version, auth.uid(), trim(requested_summary), trim(coalesce(requested_known_limitations, '')))
  returning * into result;
  update public.engagement_milestones set state = 'submitted', updated_at = now() where id = milestone_record.id;
  if engagement_record.state <> 'submitted' then engagement_record := private.engagement_set_state(engagement_record, 'submitted', engagement_record.current_terms_version_id, 'milestone.submitted', requested_idempotency_key,
    jsonb_build_object('milestone_id', milestone_record.id, 'submission_version', result.version_number));
  else
    perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, milestone_record.id, null, 'milestone.submitted', engagement_record.state, engagement_record.state, requested_idempotency_key,
      jsonb_build_object('submission_version', result.version_number));
  end if;
  return jsonb_build_object('submission_id', result.id, 'milestone_id', milestone_record.id, 'state', 'submitted', 'idempotent', false);
end;
$$;

create or replace function public.decide_engagement_milestone(
  requested_engagement_id uuid,
  requested_milestone_id uuid,
  requested_decision public.engagement_milestone_decision,
  requested_rationale text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; milestone_record public.engagement_milestones; submission_record public.engagement_milestone_submissions; decision_record public.engagement_milestone_decisions;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_rationale, ''))) not between 20 and 1600 then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  select * into decision_record from public.engagement_milestone_decisions where engagement_id = engagement_record.id and actor_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if decision_record.id is not null then return jsonb_build_object('decision_id', decision_record.id, 'idempotent', true); end if;
  select * into milestone_record from public.engagement_milestones where id = requested_milestone_id and engagement_id = engagement_record.id for update;
  select * into submission_record from public.engagement_milestone_submissions where milestone_id = milestone_record.id order by version_number desc limit 1;
  if milestone_record.id is null or milestone_record.state <> 'submitted' or submission_record.id is null or engagement_record.state <> 'submitted' then raise exception 'INVALID_STATE'; end if;
  insert into public.engagement_milestone_decisions (engagement_id, milestone_id, milestone_submission_id, actor_user_id, decision, rationale, idempotency_key)
  values (engagement_record.id, milestone_record.id, submission_record.id, auth.uid(), requested_decision, trim(requested_rationale), requested_idempotency_key) returning * into decision_record;
  if requested_decision = 'changes_requested' then
    update public.engagement_milestones set state = 'changes_requested', updated_at = now() where id = milestone_record.id;
    engagement_record := private.engagement_set_state(engagement_record, 'changes_requested', engagement_record.current_terms_version_id, 'milestone.changes_requested', requested_idempotency_key,
      jsonb_build_object('milestone_id', milestone_record.id));
  elsif requested_decision = 'accepted_for_payment' then
    update public.engagement_milestones set state = 'accepted_for_payment', updated_at = now() where id = milestone_record.id;
    if not exists (select 1 from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id and milestone.state not in ('accepted_for_payment', 'completed')) then
      engagement_record := private.engagement_set_state(engagement_record, 'accepted_for_payment', engagement_record.current_terms_version_id, 'milestone.accepted_for_payment', requested_idempotency_key,
        jsonb_build_object('milestone_id', milestone_record.id, 'payment_execution', 'deferred_to_phase_34'));
    else
      perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, milestone_record.id, null, 'milestone.accepted_for_payment', engagement_record.state, engagement_record.state, requested_idempotency_key,
        jsonb_build_object('payment_execution', 'deferred_to_phase_34'));
    end if;
  else
    update public.engagement_milestones set state = 'disputed', updated_at = now() where id = milestone_record.id;
    engagement_record := private.engagement_set_state(engagement_record, 'disputed', engagement_record.current_terms_version_id, 'engagement.disputed', requested_idempotency_key,
      jsonb_build_object('milestone_id', milestone_record.id));
    update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now()
    where engagement_id = engagement_record.id and state = 'granted';
  end if;
  return jsonb_build_object('decision_id', decision_record.id, 'engagement_state', engagement_record.state, 'idempotent', false);
end;
$$;

create or replace function public.request_engagement_access(
  requested_engagement_id uuid,
  requested_access_kind public.engagement_access_kind,
  requested_resource_label text,
  requested_purpose text,
  requested_expires_at timestamptz,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; role_record public.engagement_participant_role; result public.engagement_access_grants;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_resource_label, ''))) not between 3 and 240
    or char_length(trim(coalesce(requested_purpose, ''))) not between 10 and 600
    or requested_expires_at not between now() + interval '1 hour' and now() + interval '30 days'
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  role_record := private.engagement_actor_role(engagement_record.id);
  if engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested') then raise exception 'INVALID_STATE'; end if;
  insert into public.engagement_access_grants (engagement_id, requested_by_user_id, granted_to_user_id, requested_by_role, access_kind, resource_label, purpose, expires_at)
  values (engagement_record.id, auth.uid(), case when role_record = 'company' then engagement_record.talent_user_id else auth.uid() end, role_record, requested_access_kind, trim(requested_resource_label), trim(requested_purpose), requested_expires_at)
  returning * into result;
  perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, null, null, 'access.requested', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('access_kind', requested_access_kind, 'expires_at', requested_expires_at));
  return jsonb_build_object('access_grant_id', result.id, 'state', result.state);
end;
$$;

create or replace function public.grant_engagement_access(
  requested_access_grant_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare grant_record public.engagement_access_grants; engagement_record public.engagements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into grant_record from public.engagement_access_grants where id = requested_access_grant_id for update;
  engagement_record := private.require_engagement_company_owner(grant_record.engagement_id);
  if grant_record.id is null or grant_record.state <> 'requested' or grant_record.granted_to_user_id <> engagement_record.talent_user_id
    or grant_record.expires_at <= now() or engagement_record.state not in ('funded', 'in_progress')
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  update public.engagement_access_grants set state = 'granted', granted_by_user_id = auth.uid(), updated_at = now() where id = grant_record.id returning * into grant_record;
  perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, null, null, 'access.granted', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('access_kind', grant_record.access_kind, 'expires_at', grant_record.expires_at));
  return jsonb_build_object('access_grant_id', grant_record.id, 'state', grant_record.state, 'expires_at', grant_record.expires_at);
end;
$$;

create or replace function public.revoke_engagement_access(
  requested_access_grant_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare grant_record public.engagement_access_grants; engagement_record public.engagements;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into grant_record from public.engagement_access_grants where id = requested_access_grant_id for update;
  engagement_record := private.require_engagement_participant(grant_record.engagement_id);
  if grant_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if grant_record.state in ('revoked', 'expired', 'denied') then return jsonb_build_object('access_grant_id', grant_record.id, 'state', grant_record.state, 'idempotent', true); end if;
  update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now() where id = grant_record.id returning * into grant_record;
  perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, null, null, 'access.revoked', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('access_kind', grant_record.access_kind));
  return jsonb_build_object('access_grant_id', grant_record.id, 'state', grant_record.state);
end;
$$;

create or replace function public.cancel_engagement_before_start(
  requested_engagement_id uuid,
  requested_reason text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_reason, ''))) not between 20 and 600 then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if engagement_record.state = 'cancelled_before_start' then return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true); end if;
  if engagement_record.state not in ('draft', 'proposed', 'negotiating', 'accepted', 'funding_required', 'funded') then raise exception 'INVALID_STATE'; end if;
  engagement_record := private.engagement_set_state(engagement_record, 'cancelled_before_start', engagement_record.current_terms_version_id, 'engagement.cancelled_before_start', requested_idempotency_key,
    jsonb_build_object('funding_reconciliation_required', engagement_record.funding_state = 'verified_funded'));
  update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now()
  where engagement_id = engagement_record.id and state in ('requested', 'granted');
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'funding_reconciliation_required', engagement_record.funding_state = 'verified_funded');
end;
$$;

create or replace function public.terminate_engagement(
  requested_engagement_id uuid,
  requested_reason text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_reason, ''))) not between 20 and 900 then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if engagement_record.state = 'terminated' then return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true); end if;
  if engagement_record.state not in ('in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'disputed') then raise exception 'INVALID_STATE'; end if;
  engagement_record := private.engagement_set_state(engagement_record, 'terminated', engagement_record.current_terms_version_id, 'engagement.terminated', requested_idempotency_key,
    jsonb_build_object('evidence_preserved', true, 'payment_reconciliation_required', engagement_record.funding_state = 'verified_funded'));
  update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now() where engagement_id = engagement_record.id and state = 'granted';
  return jsonb_build_object('engagement_id', engagement_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.open_engagement_dispute(
  requested_engagement_id uuid,
  requested_milestone_id uuid,
  requested_category public.engagement_dispute_category,
  requested_reason text,
  requested_remedy text,
  requested_evidence_submission_version_ids uuid[],
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; milestone_record public.engagement_milestones; dispute_record public.engagement_disputes;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_reason, ''))) not between 30 and 1800
    or char_length(trim(coalesce(requested_remedy, ''))) not between 20 and 1200
    or cardinality(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) > 8
    or cardinality(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) <> cardinality(array(select distinct value from unnest(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) value))
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  if exists (select 1 from public.engagement_events event where event.engagement_id = engagement_record.id and event.actor_user_id = auth.uid() and event.event_type = 'engagement.disputed' and event.idempotency_key = requested_idempotency_key) then
    select * into dispute_record from public.engagement_disputes dispute where dispute.engagement_id = engagement_record.id and dispute.opened_by_user_id = auth.uid() order by dispute.opened_at desc limit 1;
    return jsonb_build_object('dispute_id', dispute_record.id, 'engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true);
  end if;
  if engagement_record.state = 'disputed' then raise exception 'CONFLICT'; end if;
  if engagement_record.state not in ('funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed') then raise exception 'INVALID_STATE'; end if;
  if requested_milestone_id is not null then
    select * into milestone_record from public.engagement_milestones where id = requested_milestone_id and engagement_id = engagement_record.id for update;
    if milestone_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  end if;
  if exists (
    select 1 from unnest(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) source_id
    where not exists (
      select 1 from public.engagement_milestone_submissions submission
      where submission.engagement_id = engagement_record.id and submission.workspace_submission_version_id = source_id
    )
  ) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.engagement_disputes (engagement_id, milestone_id, opened_by_user_id, category, reason, requested_remedy, evidence_submission_version_ids)
  values (engagement_record.id, requested_milestone_id, auth.uid(), requested_category, trim(requested_reason), trim(requested_remedy), coalesce(requested_evidence_submission_version_ids, '{}'::uuid[]))
  returning * into dispute_record;
  update public.engagements set state = 'disputed', disputed_at = now(), updated_at = now()
  where id = engagement_record.id returning * into engagement_record;
  if milestone_record.id is not null then update public.engagement_milestones set state = 'disputed', updated_at = now() where id = milestone_record.id; end if;
  update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now() where engagement_id = engagement_record.id and state = 'granted';
  if engagement_record.workspace_id is not null then
    update public.project_workspaces set state = 'paused', updated_at = now()
    where id = engagement_record.workspace_id and state in ('active', 'awaiting_submission');
  end if;
  perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, requested_milestone_id, dispute_record.id, 'engagement.disputed', 'in_progress', 'disputed', requested_idempotency_key,
    jsonb_build_object('category', requested_category, 'new_work_paused', true));
  return jsonb_build_object('dispute_id', dispute_record.id, 'engagement_id', engagement_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.resolve_engagement_dispute(
  requested_dispute_id uuid,
  requested_outcome text,
  requested_resolution_summary text,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare dispute_record public.engagement_disputes; engagement_record public.engagements; resolution_record public.engagement_dispute_resolutions; next_state public.engagement_state;
begin
  if not public.has_active_platform_administrator_context() or requested_idempotency_key is null
    or requested_outcome not in ('returned_to_parties', 'terminated_with_hold', 'cancelled_before_start', 'escalated_to_payment_provider', 'no_platform_action')
    or char_length(trim(coalesce(requested_resolution_summary, ''))) not between 30 and 1800
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into dispute_record from public.engagement_disputes where id = requested_dispute_id for update;
  select * into engagement_record from public.engagements where id = dispute_record.engagement_id for update;
  if dispute_record.id is null or engagement_record.id is null or dispute_record.state not in ('open', 'under_review') or engagement_record.state <> 'disputed' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.engagement_dispute_resolutions (dispute_id, engagement_id, resolved_by_user_id, outcome, resolution_summary)
  values (dispute_record.id, engagement_record.id, auth.uid(), requested_outcome, trim(requested_resolution_summary)) returning * into resolution_record;
  update public.engagement_disputes set state = 'resolved', updated_at = now() where id = dispute_record.id;
  next_state := case requested_outcome when 'terminated_with_hold' then 'terminated'::public.engagement_state when 'cancelled_before_start' then 'cancelled_before_start'::public.engagement_state else 'resolved'::public.engagement_state end;
  if next_state = 'resolved' then
    update public.engagements set state = 'resolved', updated_at = now() where id = engagement_record.id returning * into engagement_record;
    perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, null, dispute_record.id, 'engagement.resolved', 'disputed', 'resolved', requested_idempotency_key,
      jsonb_build_object('outcome', requested_outcome));
  else
    engagement_record := private.engagement_set_state(engagement_record, next_state, engagement_record.current_terms_version_id,
      case when next_state = 'terminated' then 'engagement.terminated' else 'engagement.cancelled_before_start' end,
      requested_idempotency_key, jsonb_build_object('dispute_resolution_id', resolution_record.id));
  end if;
  return jsonb_build_object('dispute_id', dispute_record.id, 'resolution_id', resolution_record.id, 'state', engagement_record.state);
end;
$$;

create or replace function public.propose_engagement_change_order(
  requested_engagement_id uuid,
  requested_additive_scope text,
  requested_additive_milestones jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; base_terms public.engagement_terms_versions; result public.engagement_change_orders; candidate jsonb;
begin
  if requested_idempotency_key is null
    or char_length(trim(coalesce(requested_additive_scope, ''))) not between 20 and 1600
    or jsonb_typeof(requested_additive_milestones) <> 'array'
    or jsonb_array_length(requested_additive_milestones) not between 1 and 8
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  if engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment')
    or engagement_record.workspace_id is null
  then raise exception 'INVALID_STATE'; end if;
  select * into result from public.engagement_change_orders
  where engagement_id = engagement_record.id and proposed_by_user_id = auth.uid()
    and idempotency_key = requested_idempotency_key;
  if result.id is not null then
    return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', true);
  end if;
  select * into base_terms from public.engagement_terms_versions
  where id = engagement_record.current_terms_version_id and state = 'accepted';
  candidate := base_terms.terms_snapshot || jsonb_build_object(
    'additive_scope', trim(requested_additive_scope),
    'milestones', base_terms.terms_snapshot->'milestones' || requested_additive_milestones
  );
  if base_terms.id is null or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, candidate) then
    raise exception 'VALIDATION_FAILED';
  end if;
  insert into public.engagement_change_orders (
    engagement_id, base_terms_version_id, proposed_by_user_id, additive_scope,
    additive_milestones, idempotency_key
  ) values (
    engagement_record.id, base_terms.id, auth.uid(), trim(requested_additive_scope),
    requested_additive_milestones, requested_idempotency_key
  ) returning * into result;
  perform private.append_engagement_event(
    engagement_record.id, base_terms.id, null, null, 'change_order.proposed',
    engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('change_order_id', result.id)
  );
  return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.accept_engagement_change_order(
  requested_change_order_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare change_record public.engagement_change_orders; engagement_record public.engagements; base_terms public.engagement_terms_versions; replacement public.engagement_terms_versions; next_version integer; item jsonb; task_ids uuid[]; milestone_index integer;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into change_record from public.engagement_change_orders where id = requested_change_order_id for update;
  if change_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  engagement_record := private.require_engagement_participant(change_record.engagement_id);
  if private.engagement_actor_role(engagement_record.id) <> 'talent' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if change_record.state = 'accepted' then
    return jsonb_build_object('change_order_id', change_record.id, 'state', change_record.state, 'idempotent', true);
  end if;
  if change_record.state <> 'proposed'
    or engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment')
  then raise exception 'INVALID_STATE'; end if;
  select * into base_terms from public.engagement_terms_versions
  where id = change_record.base_terms_version_id and state = 'accepted';
  if base_terms.id is null or base_terms.id <> engagement_record.current_terms_version_id then raise exception 'CONFLICT'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.engagement_terms_versions where engagement_id = engagement_record.id;
  insert into public.engagement_terms_versions (
    engagement_id, version_number, state, terms_snapshot, created_by_user_id,
    proposed_at, accepted_at
  ) values (
    engagement_record.id, next_version, 'accepted',
    base_terms.terms_snapshot || jsonb_build_object(
      'additive_scope', change_record.additive_scope,
      'change_order_id', change_record.id,
      'milestones', base_terms.terms_snapshot->'milestones' || change_record.additive_milestones
    ), change_record.proposed_by_user_id, now(), now()
  ) returning * into replacement;
  if not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, replacement.terms_snapshot) then
    raise exception 'VALIDATION_FAILED';
  end if;
  insert into public.engagement_terms_acceptances (
    engagement_id, terms_version_id, participant_role, accepted_by_user_id, idempotency_key
  ) values
    (engagement_record.id, replacement.id, 'company', change_record.proposed_by_user_id, requested_idempotency_key),
    (engagement_record.id, replacement.id, 'talent', auth.uid(), requested_idempotency_key)
  on conflict (terms_version_id, participant_role) do nothing;
  update public.engagements set current_terms_version_id = replacement.id, updated_at = now()
  where id = engagement_record.id returning * into engagement_record;
  select coalesce(max(milestone.milestone_index), -1) + 1 into milestone_index
  from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id;
  for item in select value from jsonb_array_elements(change_record.additive_milestones) loop
    select coalesce(array_agg((value #>> '{}')::uuid), '{}'::uuid[]) into task_ids
    from jsonb_array_elements(coalesce(item->'linked_task_ids', '[]'::jsonb));
    if exists (
      select 1 from unnest(task_ids) task_id
      where not exists (
        select 1 from public.project_workspace_tasks task
        where task.id = task_id and task.workspace_id = engagement_record.workspace_id
      )
    ) then raise exception 'VALIDATION_FAILED'; end if;
    insert into public.engagement_milestones (
      engagement_id, terms_version_id, milestone_index, title, description, deliverable_type,
      definition_of_done, due_date, amount_minor, currency, revision_allowance,
      approver_role, timeout_policy, evidence_policy, linked_task_ids, state
    ) values (
      engagement_record.id, replacement.id, milestone_index, trim(item->>'title'),
      trim(item->>'description'), trim(item->>'deliverable_type'),
      trim(item->>'definition_of_done'), (item->>'due_date')::date,
      (item->>'amount_minor')::bigint, item->>'currency',
      (item->>'revision_allowance')::integer, 'company',
      trim(item->>'timeout_policy'), trim(item->>'evidence_policy'), task_ids,
      case when engagement_record.state in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment') then 'in_progress'::public.engagement_milestone_state else 'pending_funding'::public.engagement_milestone_state end
    );
    milestone_index := milestone_index + 1;
  end loop;
  update public.engagement_change_orders
  set state = 'accepted', accepted_at = now(), updated_at = now()
  where id = change_record.id;
  perform private.append_engagement_event(
    engagement_record.id, replacement.id, null, null, 'change_order.accepted',
    engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('change_order_id', change_record.id, 'terms_version', replacement.version_number)
  );
  return jsonb_build_object('change_order_id', change_record.id, 'terms_version_id', replacement.id, 'state', 'accepted', 'idempotent', false);
end;
$$;

create or replace function public.get_engagement_for_participant(requested_engagement_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare engagement_record public.engagements; role_record public.engagement_participant_role;
begin
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  role_record := private.engagement_actor_role(engagement_record.id);
  return jsonb_build_object(
    'id', engagement_record.id, 'engagement_type', engagement_record.engagement_type, 'state', engagement_record.state,
    'funding_state', engagement_record.funding_state, 'market_code', engagement_record.market_code, 'currency', engagement_record.currency,
    'workspace_id', engagement_record.workspace_id, 'participant_role', role_record, 'proposal_expires_at', engagement_record.proposal_expires_at,
    'terms', coalesce((select jsonb_build_object('id', version.id, 'version', version.version_number, 'state', version.state, 'snapshot', version.terms_snapshot, 'accepted_at', version.accepted_at) from public.engagement_terms_versions version where version.id = engagement_record.current_terms_version_id), '{}'::jsonb),
    'terms_history', coalesce((select jsonb_agg(jsonb_build_object('id', version.id, 'version', version.version_number, 'state', version.state, 'created_at', version.created_at, 'proposed_at', version.proposed_at, 'accepted_at', version.accepted_at, 'superseded_at', version.superseded_at) order by version.version_number desc) from public.engagement_terms_versions version where version.engagement_id = engagement_record.id), '[]'::jsonb),
    'acceptances', coalesce((select jsonb_agg(jsonb_build_object('terms_version_id', acceptance.terms_version_id, 'participant_role', acceptance.participant_role, 'is_current_actor', acceptance.accepted_by_user_id = auth.uid(), 'accepted_at', acceptance.accepted_at) order by acceptance.accepted_at) from public.engagement_terms_acceptances acceptance where acceptance.engagement_id = engagement_record.id), '[]'::jsonb),
    'negotiation', coalesce((select jsonb_agg(jsonb_build_object('id', entry.id, 'terms_version_id', entry.terms_version_id, 'entry_type', entry.entry_type, 'body', entry.body, 'is_current_actor', entry.actor_user_id = auth.uid(), 'created_at', entry.created_at) order by entry.created_at) from public.engagement_negotiation_entries entry where entry.engagement_id = engagement_record.id), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('id', milestone.id, 'index', milestone.milestone_index, 'title', milestone.title, 'description', milestone.description, 'deliverable_type', milestone.deliverable_type, 'definition_of_done', milestone.definition_of_done, 'due_date', milestone.due_date, 'amount_minor', milestone.amount_minor, 'currency', milestone.currency, 'revision_allowance', milestone.revision_allowance, 'state', milestone.state, 'timeout_policy', milestone.timeout_policy, 'evidence_policy', milestone.evidence_policy, 'submission_count', (select count(*) from public.engagement_milestone_submissions submission where submission.milestone_id = milestone.id)) order by milestone.milestone_index) from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id), '[]'::jsonb),
    'access_grants', coalesce((select jsonb_agg(jsonb_build_object('id', access.id, 'access_kind', access.access_kind, 'resource_label', access.resource_label, 'purpose', access.purpose, 'state', case when access.state = 'granted' and access.expires_at <= now() then 'expired' else access.state end, 'expires_at', access.expires_at, 'is_current_actor_request', access.requested_by_user_id = auth.uid()) order by access.created_at desc) from public.engagement_access_grants access where access.engagement_id = engagement_record.id), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(jsonb_build_object('id', dispute.id, 'milestone_id', dispute.milestone_id, 'category', dispute.category, 'reason', dispute.reason, 'requested_remedy', dispute.requested_remedy, 'state', dispute.state, 'opened_at', dispute.opened_at) order by dispute.opened_at desc) from public.engagement_disputes dispute where dispute.engagement_id = engagement_record.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('event_type', event.event_type, 'previous_state', event.previous_state, 'next_state', event.next_state, 'terms_version_id', event.terms_version_id, 'milestone_id', event.milestone_id, 'occurred_at', event.occurred_at) order by event.occurred_at asc) from public.engagement_events event where event.engagement_id = engagement_record.id), '[]'::jsonb),
    'safety', jsonb_build_object('platform_record_not_legal_determination', true, 'payment_execution', 'not_available_until_verified_provider_integration', 'production_access', 'blocked_by_default', 'personal_credentials', 'prohibited', 'support_route', coalesce((select version.terms_snapshot->>'support_route' from public.engagement_terms_versions version where version.id = engagement_record.current_terms_version_id), ''))
  );
end;
$$;

create or replace function public.get_talent_engagements(maximum_count integer default 50)
returns jsonb language sql security definer stable set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', engagement.id, 'engagement_type', engagement.engagement_type, 'state', engagement.state, 'funding_state', engagement.funding_state, 'project_title', project.title, 'organization_name', organization.name, 'updated_at', engagement.updated_at) order by engagement.updated_at desc), '[]'::jsonb)
  from (select * from public.engagements where talent_user_id = auth.uid() and private.engagement_talent_context(auth.uid()) order by updated_at desc limit least(greatest(coalesce(maximum_count,0),0),100)) engagement
  join public.company_project_drafts project on project.id = engagement.project_id
  join public.organizations organization on organization.id = engagement.organization_id
$$;

create or replace function public.get_company_engagements(maximum_count integer default 50)
returns jsonb language sql security definer stable set search_path = public, private as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', engagement.id, 'engagement_type', engagement.engagement_type, 'state', engagement.state, 'funding_state', engagement.funding_state, 'project_title', project.title, 'updated_at', engagement.updated_at) order by engagement.updated_at desc), '[]'::jsonb)
  from (select * from public.engagements where private.engagement_company_context(organization_id, 'hiring_member') order by updated_at desc limit least(greatest(coalesce(maximum_count,0),0),100)) engagement
  join public.company_project_drafts project on project.id = engagement.project_id
$$;

create or replace function public.get_engagement_dispute_queue(maximum_count integer default 50)
returns jsonb language plpgsql security definer stable set search_path = public as $$
begin
  if not public.has_active_platform_administrator_context() then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', dispute.id, 'engagement_id', dispute.engagement_id, 'milestone_id', dispute.milestone_id, 'category', dispute.category, 'reason', dispute.reason, 'requested_remedy', dispute.requested_remedy, 'state', dispute.state, 'opened_at', dispute.opened_at) order by dispute.opened_at asc) from (select * from public.engagement_disputes where state in ('open', 'under_review') order by opened_at asc limit least(greatest(coalesce(maximum_count,0),0),100)) dispute), '[]'::jsonb);
end;
$$;

revoke all on function private.engagement_application_for_actor(uuid), private.engagement_transition_allowed(public.engagement_state, public.engagement_state), private.engagement_set_state(public.engagements, public.engagement_state, uuid, text, uuid, jsonb), private.engagement_materialize_milestones(public.engagements, public.engagement_terms_versions), private.record_verified_engagement_funding(uuid, text, public.engagement_funding_state) from public, anon, authenticated;
revoke all on function public.create_engagement_draft(uuid, public.engagement_type, text, text, uuid, uuid), public.save_engagement_terms_draft(uuid, jsonb, uuid), public.propose_engagement_terms(uuid, uuid), public.record_engagement_negotiation_entry(uuid, text, text, uuid), public.create_engagement_terms_revision(uuid, jsonb, uuid), public.accept_engagement_terms(uuid, uuid, uuid), public.require_engagement_funding(uuid, uuid), public.expire_engagement_offer(uuid, uuid), public.link_engagement_workspace(uuid, uuid, uuid), public.start_engagement_work(uuid, uuid), public.submit_engagement_milestone(uuid, uuid, uuid, text, text, uuid), public.decide_engagement_milestone(uuid, uuid, public.engagement_milestone_decision, text, uuid), public.request_engagement_access(uuid, public.engagement_access_kind, text, text, timestamptz, uuid), public.grant_engagement_access(uuid, uuid), public.revoke_engagement_access(uuid, uuid), public.cancel_engagement_before_start(uuid, text, uuid), public.terminate_engagement(uuid, text, uuid), public.open_engagement_dispute(uuid, uuid, public.engagement_dispute_category, text, text, uuid[], uuid), public.propose_engagement_change_order(uuid, text, jsonb, uuid), public.accept_engagement_change_order(uuid, uuid), public.resolve_engagement_dispute(uuid, text, text, uuid), public.get_engagement_for_participant(uuid), public.get_talent_engagements(integer), public.get_company_engagements(integer), public.get_engagement_dispute_queue(integer) from public, anon;
grant execute on function public.create_engagement_draft(uuid, public.engagement_type, text, text, uuid, uuid), public.save_engagement_terms_draft(uuid, jsonb, uuid), public.propose_engagement_terms(uuid, uuid), public.record_engagement_negotiation_entry(uuid, text, text, uuid), public.create_engagement_terms_revision(uuid, jsonb, uuid), public.accept_engagement_terms(uuid, uuid, uuid), public.require_engagement_funding(uuid, uuid), public.expire_engagement_offer(uuid, uuid), public.link_engagement_workspace(uuid, uuid, uuid), public.start_engagement_work(uuid, uuid), public.submit_engagement_milestone(uuid, uuid, uuid, text, text, uuid), public.decide_engagement_milestone(uuid, uuid, public.engagement_milestone_decision, text, uuid), public.request_engagement_access(uuid, public.engagement_access_kind, text, text, timestamptz, uuid), public.grant_engagement_access(uuid, uuid), public.revoke_engagement_access(uuid, uuid), public.cancel_engagement_before_start(uuid, text, uuid), public.terminate_engagement(uuid, text, uuid), public.open_engagement_dispute(uuid, uuid, public.engagement_dispute_category, text, text, uuid[], uuid), public.propose_engagement_change_order(uuid, text, jsonb, uuid), public.accept_engagement_change_order(uuid, uuid), public.get_engagement_for_participant(uuid), public.get_talent_engagements(integer), public.get_company_engagements(integer), public.get_engagement_dispute_queue(integer) to authenticated;
grant execute on function public.resolve_engagement_dispute(uuid, text, text, uuid) to authenticated;
