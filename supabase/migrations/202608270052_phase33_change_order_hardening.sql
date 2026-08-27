-- Phase 33 hardening — accepted scope changes must remain additive, versioned, and compensated.

alter table public.engagement_change_orders
  add column additive_amount_minor bigint not null default 1 check (additive_amount_minor > 0);

create or replace function private.engagement_terms_payload_is_valid(
  target_type public.engagement_type,
  requested_terms jsonb
) returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare milestone jsonb;
begin
  if jsonb_typeof(requested_terms) <> 'object'
    or exists (select 1 from jsonb_object_keys(requested_terms) key where key <> all(array[
      'summary', 'scope', 'deliverables', 'exclusions', 'dependencies', 'assumptions',
      'start_date', 'deadline', 'expected_effort_hours', 'timezone', 'communication_cadence',
      'compensation_amount_minor', 'currency', 'platform_fee_minor', 'taxes_and_fees_note',
      'payment_trigger', 'payment_cadence', 'funding_requirement', 'acceptance_criteria', 'revision_allowance',
      'access_terms', 'confidentiality_terms', 'ownership_terms', 'license_terms',
      'portfolio_visibility', 'cancellation_terms', 'termination_terms', 'dispute_terms',
      'support_route', 'market_code', 'market_limitation_notice', 'additive_scope', 'change_order_id', 'milestones'
    ]))
    or char_length(trim(coalesce(requested_terms->>'summary', ''))) not between 20 and 600
    or char_length(trim(coalesce(requested_terms->>'scope', ''))) not between 30 and 1800
    or char_length(trim(coalesce(requested_terms->>'deliverables', ''))) not between 20 and 1800
    or char_length(trim(coalesce(requested_terms->>'exclusions', ''))) not between 10 and 900
    or char_length(trim(coalesce(requested_terms->>'dependencies', ''))) > 900
    or char_length(trim(coalesce(requested_terms->>'assumptions', ''))) > 900
    or coalesce(requested_terms->>'start_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(requested_terms->>'deadline', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(requested_terms->>'expected_effort_hours', '') !~ '^[1-9][0-9]{0,3}$'
    or char_length(trim(coalesce(requested_terms->>'timezone', ''))) not between 1 and 80
    or char_length(trim(coalesce(requested_terms->>'communication_cadence', ''))) not between 5 and 240
    or coalesce(requested_terms->>'compensation_amount_minor', '') !~ '^[1-9][0-9]{0,14}$'
    or coalesce(requested_terms->>'currency', '') !~ '^[A-Z]{3}$'
    or coalesce(requested_terms->>'platform_fee_minor', '') !~ '^[0-9]{1,14}$'
    or char_length(trim(coalesce(requested_terms->>'taxes_and_fees_note', ''))) not between 10 and 600
    or coalesce(requested_terms->>'payment_trigger', '') not in ('milestone_accepted', 'engagement_completed')
    or coalesce(requested_terms->>'payment_cadence', '') not in ('per_milestone', 'weekly', 'biweekly', 'monthly')
    or coalesce(requested_terms->>'funding_requirement', '') <> 'provider_verified_before_work'
    or char_length(trim(coalesce(requested_terms->>'acceptance_criteria', ''))) not between 20 and 1800
    or coalesce(requested_terms->>'revision_allowance', '') !~ '^[0-8]$'
    or jsonb_typeof(coalesce(requested_terms->'access_terms', '{}'::jsonb)) <> 'object'
    or coalesce(requested_terms->'access_terms'->>'production_access', '') <> 'blocked'
    or coalesce(requested_terms->'access_terms'->>'personal_credentials', '') <> 'prohibited'
    or char_length(trim(coalesce(requested_terms->'access_terms'->>'approved_tools', ''))) > 600
    or char_length(trim(coalesce(requested_terms->>'confidentiality_terms', ''))) not between 10 and 1200
    or char_length(trim(coalesce(requested_terms->>'ownership_terms', ''))) not between 10 and 1200
    or char_length(trim(coalesce(requested_terms->>'license_terms', ''))) not between 10 and 1200
    or coalesce(requested_terms->>'portfolio_visibility', '') not in ('private_until_explicit_consent', 'not_permitted')
    or char_length(trim(coalesce(requested_terms->>'cancellation_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'termination_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'dispute_terms', ''))) not between 20 and 1200
    or char_length(trim(coalesce(requested_terms->>'support_route', ''))) not between 3 and 240
    or coalesce(requested_terms->>'market_code', '') !~ '^[A-Z]{2,8}$'
    or char_length(trim(coalesce(requested_terms->>'market_limitation_notice', ''))) not between 20 and 900
    or ((requested_terms ? 'additive_scope') <> (requested_terms ? 'change_order_id'))
    or (requested_terms ? 'additive_scope' and char_length(trim(requested_terms->>'additive_scope')) not between 20 and 1600)
    or (requested_terms ? 'change_order_id' and coalesce(requested_terms->>'change_order_id', '') !~ '^[0-9a-fA-F-]{36}$')
    or jsonb_typeof(coalesce(requested_terms->'milestones', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(requested_terms->'milestones', '[]'::jsonb)) not between 1 and 8
    or octet_length(requested_terms::text) > 18000
  then return false; end if;
  if target_type = 'paid_trial' and (jsonb_array_length(requested_terms->'milestones') <> 1 or (requested_terms->>'expected_effort_hours')::integer > 160 or requested_terms->>'payment_cadence' <> 'per_milestone') then return false; end if;
  if target_type = 'ongoing_contract' and requested_terms->>'payment_cadence' = 'per_milestone' then return false; end if;
  for milestone in select value from jsonb_array_elements(requested_terms->'milestones') loop
    if jsonb_typeof(milestone) <> 'object'
      or exists (select 1 from jsonb_object_keys(milestone) key where key <> all(array['title','description','deliverable_type','definition_of_done','due_date','amount_minor','currency','revision_allowance','approver_role','timeout_policy','evidence_policy','linked_task_ids']))
      or char_length(trim(coalesce(milestone->>'title', ''))) not between 3 and 160
      or char_length(trim(coalesce(milestone->>'description', ''))) not between 10 and 1400
      or char_length(trim(coalesce(milestone->>'deliverable_type', ''))) not between 3 and 120
      or char_length(trim(coalesce(milestone->>'definition_of_done', ''))) not between 20 and 1600
      or coalesce(milestone->>'due_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(milestone->>'amount_minor', '') !~ '^[1-9][0-9]{0,14}$'
      or milestone->>'currency' <> requested_terms->>'currency'
      or coalesce(milestone->>'revision_allowance', '') !~ '^[0-8]$'
      or coalesce(milestone->>'approver_role', '') <> 'company'
      or char_length(trim(coalesce(milestone->>'timeout_policy', ''))) not between 10 and 360
      or char_length(trim(coalesce(milestone->>'evidence_policy', ''))) not between 10 and 600
      or jsonb_typeof(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) > 8
      or exists (select 1 from jsonb_array_elements_text(coalesce(milestone->'linked_task_ids', '[]'::jsonb)) item where item !~ '^[0-9a-fA-F-]{36}$')
    then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.propose_engagement_change_order(
  requested_engagement_id uuid,
  requested_additive_scope text,
  requested_additive_milestones jsonb,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare engagement_record public.engagements; base_terms public.engagement_terms_versions; result public.engagement_change_orders; candidate jsonb; amount_total bigint;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_additive_scope, ''))) not between 20 and 1600
    or jsonb_typeof(requested_additive_milestones) <> 'array' or jsonb_array_length(requested_additive_milestones) not between 1 and 8
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_company_owner(requested_engagement_id);
  if engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment') or engagement_record.workspace_id is null then raise exception 'INVALID_STATE'; end if;
  select * into result from public.engagement_change_orders where engagement_id = engagement_record.id and proposed_by_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', true); end if;
  select * into base_terms from public.engagement_terms_versions where id = engagement_record.current_terms_version_id and state = 'accepted';
  select coalesce(sum((item->>'amount_minor')::bigint), 0) into amount_total from jsonb_array_elements(requested_additive_milestones) item;
  candidate := base_terms.terms_snapshot || jsonb_build_object(
    'additive_scope', trim(requested_additive_scope),
    'change_order_id', gen_random_uuid(),
    'compensation_amount_minor', ((base_terms.terms_snapshot->>'compensation_amount_minor')::bigint + amount_total)::text,
    'milestones', base_terms.terms_snapshot->'milestones' || requested_additive_milestones
  );
  if base_terms.id is null or amount_total <= 0 or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, candidate) then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.engagement_change_orders (engagement_id, base_terms_version_id, proposed_by_user_id, additive_scope, additive_milestones, additive_amount_minor, idempotency_key)
  values (engagement_record.id, base_terms.id, auth.uid(), trim(requested_additive_scope), requested_additive_milestones, amount_total, requested_idempotency_key)
  returning * into result;
  perform private.append_engagement_event(engagement_record.id, base_terms.id, null, null, 'change_order.proposed', engagement_record.state, engagement_record.state, requested_idempotency_key, jsonb_build_object('change_order_id', result.id, 'additive_amount_minor', amount_total));
  return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

create or replace function public.accept_engagement_change_order(
  requested_change_order_id uuid,
  requested_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare change_record public.engagement_change_orders; engagement_record public.engagements; base_terms public.engagement_terms_versions; replacement public.engagement_terms_versions; next_version integer; item jsonb; task_ids uuid[]; milestone_index integer; snapshot jsonb;
begin
  if requested_idempotency_key is null then raise exception 'VALIDATION_FAILED'; end if;
  select * into change_record from public.engagement_change_orders where id = requested_change_order_id for update;
  if change_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  engagement_record := private.require_engagement_participant(change_record.engagement_id);
  if private.engagement_actor_role(engagement_record.id) <> 'talent' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  if change_record.state = 'accepted' then return jsonb_build_object('change_order_id', change_record.id, 'state', change_record.state, 'idempotent', true); end if;
  if change_record.state <> 'proposed' or engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment') then raise exception 'INVALID_STATE'; end if;
  select * into base_terms from public.engagement_terms_versions where id = change_record.base_terms_version_id and state = 'accepted';
  if base_terms.id is null or base_terms.id <> engagement_record.current_terms_version_id then raise exception 'CONFLICT'; end if;
  snapshot := base_terms.terms_snapshot || jsonb_build_object(
    'additive_scope', change_record.additive_scope,
    'change_order_id', change_record.id,
    'compensation_amount_minor', ((base_terms.terms_snapshot->>'compensation_amount_minor')::bigint + change_record.additive_amount_minor)::text,
    'milestones', base_terms.terms_snapshot->'milestones' || change_record.additive_milestones
  );
  if not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, snapshot) then raise exception 'VALIDATION_FAILED'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.engagement_terms_versions where engagement_id = engagement_record.id;
  insert into public.engagement_terms_versions (engagement_id, version_number, state, terms_snapshot, created_by_user_id, proposed_at, accepted_at)
  values (engagement_record.id, next_version, 'accepted', snapshot, change_record.proposed_by_user_id, now(), now()) returning * into replacement;
  insert into public.engagement_terms_acceptances (engagement_id, terms_version_id, participant_role, accepted_by_user_id, idempotency_key)
  values (engagement_record.id, replacement.id, 'company', change_record.proposed_by_user_id, requested_idempotency_key), (engagement_record.id, replacement.id, 'talent', auth.uid(), requested_idempotency_key)
  on conflict (terms_version_id, participant_role) do nothing;
  update public.engagements set current_terms_version_id = replacement.id, updated_at = now() where id = engagement_record.id returning * into engagement_record;
  select coalesce(max(milestone.milestone_index), -1) + 1 into milestone_index from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id;
  for item in select value from jsonb_array_elements(change_record.additive_milestones) loop
    select coalesce(array_agg((value #>> '{}')::uuid), '{}'::uuid[]) into task_ids from jsonb_array_elements(coalesce(item->'linked_task_ids', '[]'::jsonb));
    if exists (select 1 from unnest(task_ids) task_id where not exists (select 1 from public.project_workspace_tasks task where task.id = task_id and task.workspace_id = engagement_record.workspace_id)) then raise exception 'VALIDATION_FAILED'; end if;
    insert into public.engagement_milestones (engagement_id, terms_version_id, milestone_index, title, description, deliverable_type, definition_of_done, due_date, amount_minor, currency, revision_allowance, approver_role, timeout_policy, evidence_policy, linked_task_ids, state)
    values (engagement_record.id, replacement.id, milestone_index, trim(item->>'title'), trim(item->>'description'), trim(item->>'deliverable_type'), trim(item->>'definition_of_done'), (item->>'due_date')::date, (item->>'amount_minor')::bigint, item->>'currency', (item->>'revision_allowance')::integer, 'company', trim(item->>'timeout_policy'), trim(item->>'evidence_policy'), task_ids, 'in_progress');
    milestone_index := milestone_index + 1;
  end loop;
  update public.engagement_change_orders set state = 'accepted', accepted_at = now(), updated_at = now() where id = change_record.id;
  perform private.append_engagement_event(engagement_record.id, replacement.id, null, null, 'change_order.accepted', engagement_record.state, engagement_record.state, requested_idempotency_key, jsonb_build_object('change_order_id', change_record.id, 'terms_version', replacement.version_number));
  return jsonb_build_object('change_order_id', change_record.id, 'terms_version_id', replacement.id, 'state', 'accepted', 'idempotent', false);
end;
$$;

revoke all on function private.engagement_terms_payload_is_valid(public.engagement_type, jsonb) from public, anon, authenticated;
revoke all on function public.propose_engagement_change_order(uuid, text, jsonb, uuid), public.accept_engagement_change_order(uuid, uuid) from public, anon;
grant execute on function public.propose_engagement_change_order(uuid, text, jsonb, uuid), public.accept_engagement_change_order(uuid, uuid) to authenticated;
