-- Phase 33 hardening — idempotent work records, access safety, disputes, and multi-milestone continuity.

alter table public.engagement_milestone_submissions add column idempotency_key uuid;
create unique index engagement_milestone_submissions_idempotency_idx
  on public.engagement_milestone_submissions(milestone_id, submitted_by_user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.engagement_access_grants add column idempotency_key uuid;
create unique index engagement_access_grants_idempotency_idx
  on public.engagement_access_grants(engagement_id, requested_by_user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.engagement_disputes add column opened_idempotency_key uuid;
create unique index engagement_disputes_idempotency_idx
  on public.engagement_disputes(engagement_id, opened_by_user_id, opened_idempotency_key)
  where opened_idempotency_key is not null;

alter table public.engagement_dispute_resolutions add column idempotency_key uuid;
create unique index engagement_dispute_resolutions_idempotency_idx
  on public.engagement_dispute_resolutions(dispute_id, resolved_by_user_id, idempotency_key)
  where idempotency_key is not null;

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
    or (current_state = 'submitted' and requested_state in ('in_progress', 'changes_requested', 'accepted_for_payment', 'terminated', 'disputed'))
    or (current_state = 'changes_requested' and requested_state in ('in_progress', 'submitted', 'terminated', 'disputed'))
    or (current_state = 'accepted_for_payment' and requested_state in ('in_progress', 'completed', 'terminated', 'disputed'))
    or (current_state = 'completed' and requested_state in ('disputed', 'resolved'))
    or (current_state = 'disputed' and requested_state in ('resolved', 'terminated', 'cancelled_before_start'))
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
  select * into result from public.engagement_milestone_submissions
  where milestone_id = requested_milestone_id and submitted_by_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('submission_id', result.id, 'milestone_id', result.milestone_id, 'state', 'submitted', 'idempotent', true); end if;
  select * into milestone_record from public.engagement_milestones where id = requested_milestone_id and engagement_id = engagement_record.id for update;
  select * into submission_version from public.project_workspace_submission_versions where id = requested_workspace_submission_version_id;
  select * into submission_record from public.project_workspace_submissions where id = submission_version.submission_id;
  if milestone_record.id is null or milestone_record.state not in ('in_progress', 'changes_requested')
    or submission_version.id is null or submission_version.workspace_id <> engagement_record.workspace_id
    or submission_record.id is null or submission_record.talent_user_id <> auth.uid()
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select coalesce(max(version_number), 0) + 1 into next_version from public.engagement_milestone_submissions where milestone_id = milestone_record.id;
  insert into public.engagement_milestone_submissions (engagement_id, milestone_id, workspace_submission_version_id, version_number, submitted_by_user_id, summary, known_limitations, idempotency_key)
  values (engagement_record.id, milestone_record.id, submission_version.id, next_version, auth.uid(), trim(requested_summary), trim(coalesce(requested_known_limitations, '')), requested_idempotency_key)
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
    if exists (select 1 from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id and milestone.state in ('in_progress', 'changes_requested')) then
      engagement_record := private.engagement_set_state(engagement_record, 'in_progress', engagement_record.current_terms_version_id, 'milestone.accepted_for_payment', requested_idempotency_key,
        jsonb_build_object('milestone_id', milestone_record.id, 'remaining_work', true, 'payment_execution', 'deferred_to_phase_34'));
    elsif not exists (select 1 from public.engagement_milestones milestone where milestone.engagement_id = engagement_record.id and milestone.state not in ('accepted_for_payment', 'completed')) then
      engagement_record := private.engagement_set_state(engagement_record, 'accepted_for_payment', engagement_record.current_terms_version_id, 'milestone.accepted_for_payment', requested_idempotency_key,
        jsonb_build_object('milestone_id', milestone_record.id, 'payment_execution', 'deferred_to_phase_34'));
    else
      perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, milestone_record.id, null, 'milestone.accepted_for_payment', engagement_record.state, engagement_record.state, requested_idempotency_key,
        jsonb_build_object('milestone_id', milestone_record.id, 'payment_execution', 'deferred_to_phase_34'));
    end if;
  else
    update public.engagement_milestones set state = 'disputed', updated_at = now() where id = milestone_record.id;
    engagement_record := private.engagement_set_state(engagement_record, 'disputed', engagement_record.current_terms_version_id, 'engagement.disputed', requested_idempotency_key,
      jsonb_build_object('milestone_id', milestone_record.id));
    update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now()
    where engagement_id = engagement_record.id and state in ('requested', 'granted');
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
declare engagement_record public.engagements; role_record public.engagement_participant_role; result public.engagement_access_grants; sensitive_pattern constant text := '(https?://|ssh://|password|credential|secret|bearer|api[ _-]?key|access[ _-]?token|private[ _-]?key)';
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_resource_label, ''))) not between 3 and 240
    or char_length(trim(coalesce(requested_purpose, ''))) not between 10 and 600
    or lower(trim(requested_resource_label || ' ' || requested_purpose)) ~ sensitive_pattern
    or requested_expires_at not between now() + interval '1 hour' and now() + interval '30 days'
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  role_record := private.engagement_actor_role(engagement_record.id);
  if role_record <> 'talent' or engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested') then raise exception 'INVALID_STATE'; end if;
  select * into result from public.engagement_access_grants where engagement_id = engagement_record.id and requested_by_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('access_grant_id', result.id, 'state', result.state, 'idempotent', true); end if;
  insert into public.engagement_access_grants (engagement_id, requested_by_user_id, granted_to_user_id, requested_by_role, access_kind, resource_label, purpose, expires_at, idempotency_key)
  values (engagement_record.id, auth.uid(), auth.uid(), role_record, requested_access_kind, trim(requested_resource_label), trim(requested_purpose), requested_expires_at, requested_idempotency_key)
  returning * into result;
  perform private.append_engagement_event(engagement_record.id, engagement_record.current_terms_version_id, null, null, 'access.requested', engagement_record.state, engagement_record.state, requested_idempotency_key,
    jsonb_build_object('access_kind', requested_access_kind, 'expires_at', requested_expires_at, 'company_approval_required', true));
  return jsonb_build_object('access_grant_id', result.id, 'state', result.state, 'idempotent', false);
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
declare engagement_record public.engagements; milestone_record public.engagement_milestones; dispute_record public.engagement_disputes; prior_state public.engagement_state;
begin
  if requested_idempotency_key is null or char_length(trim(coalesce(requested_reason, ''))) not between 30 and 1800
    or char_length(trim(coalesce(requested_remedy, ''))) not between 20 and 1200
    or cardinality(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) > 8
    or cardinality(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) <> cardinality(array(select distinct value from unnest(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) value))
  then raise exception 'VALIDATION_FAILED'; end if;
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  select * into dispute_record from public.engagement_disputes where engagement_id = engagement_record.id and opened_by_user_id = auth.uid() and opened_idempotency_key = requested_idempotency_key;
  if dispute_record.id is not null then return jsonb_build_object('dispute_id', dispute_record.id, 'engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', true); end if;
  if engagement_record.state = 'disputed' then raise exception 'CONFLICT'; end if;
  if engagement_record.state not in ('funding_required', 'funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment', 'completed') then raise exception 'INVALID_STATE'; end if;
  if requested_milestone_id is not null then
    select * into milestone_record from public.engagement_milestones where id = requested_milestone_id and engagement_id = engagement_record.id for update;
    if milestone_record.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  end if;
  if exists (select 1 from unnest(coalesce(requested_evidence_submission_version_ids, '{}'::uuid[])) source_id where not exists (
    select 1 from public.engagement_milestone_submissions submission where submission.engagement_id = engagement_record.id and submission.workspace_submission_version_id = source_id
  )) then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  prior_state := engagement_record.state;
  insert into public.engagement_disputes (engagement_id, milestone_id, opened_by_user_id, category, reason, requested_remedy, evidence_submission_version_ids, opened_idempotency_key)
  values (engagement_record.id, requested_milestone_id, auth.uid(), requested_category, trim(requested_reason), trim(requested_remedy), coalesce(requested_evidence_submission_version_ids, '{}'::uuid[]), requested_idempotency_key)
  returning * into dispute_record;
  if milestone_record.id is not null then update public.engagement_milestones set state = 'disputed', updated_at = now() where id = milestone_record.id; end if;
  update public.engagement_access_grants set state = 'revoked', revoked_at = now(), updated_at = now() where engagement_id = engagement_record.id and state in ('requested', 'granted');
  if engagement_record.workspace_id is not null then update public.project_workspaces set state = 'paused', updated_at = now() where id = engagement_record.workspace_id and state in ('active', 'awaiting_submission'); end if;
  engagement_record := private.engagement_set_state(engagement_record, 'disputed', engagement_record.current_terms_version_id, 'engagement.disputed', requested_idempotency_key,
    jsonb_build_object('category', requested_category, 'new_work_paused', true, 'evidence_preserved', true, 'prior_state', prior_state));
  return jsonb_build_object('dispute_id', dispute_record.id, 'engagement_id', engagement_record.id, 'state', engagement_record.state, 'idempotent', false);
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
  select * into resolution_record from public.engagement_dispute_resolutions where dispute_id = requested_dispute_id and resolved_by_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if resolution_record.id is not null then return jsonb_build_object('dispute_id', resolution_record.dispute_id, 'resolution_id', resolution_record.id, 'state', 'resolved', 'idempotent', true); end if;
  select * into dispute_record from public.engagement_disputes where id = requested_dispute_id for update;
  select * into engagement_record from public.engagements where id = dispute_record.engagement_id for update;
  if dispute_record.id is null or engagement_record.id is null or dispute_record.state not in ('open', 'under_review') or engagement_record.state <> 'disputed' then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  insert into public.engagement_dispute_resolutions (dispute_id, engagement_id, resolved_by_user_id, outcome, resolution_summary, idempotency_key)
  values (dispute_record.id, engagement_record.id, auth.uid(), requested_outcome, trim(requested_resolution_summary), requested_idempotency_key) returning * into resolution_record;
  update public.engagement_disputes set state = 'resolved', updated_at = now() where id = dispute_record.id;
  next_state := case requested_outcome when 'terminated_with_hold' then 'terminated'::public.engagement_state when 'cancelled_before_start' then 'cancelled_before_start'::public.engagement_state else 'resolved'::public.engagement_state end;
  engagement_record := private.engagement_set_state(engagement_record, next_state, engagement_record.current_terms_version_id,
    case when next_state = 'terminated' then 'engagement.terminated' when next_state = 'cancelled_before_start' then 'engagement.cancelled_before_start' else 'engagement.resolved' end,
    requested_idempotency_key, jsonb_build_object('outcome', requested_outcome, 'dispute_resolution_id', resolution_record.id, 'new_work_remains_paused', true));
  return jsonb_build_object('dispute_id', dispute_record.id, 'resolution_id', resolution_record.id, 'state', engagement_record.state, 'idempotent', false);
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
  if engagement_record.engagement_type = 'paid_trial' then raise exception 'PAID_TRIAL_CHANGE_ORDER_NOT_ALLOWED'; end if;
  if engagement_record.state not in ('funded', 'in_progress', 'submitted', 'changes_requested', 'accepted_for_payment') or engagement_record.workspace_id is null then raise exception 'INVALID_STATE'; end if;
  select * into result from public.engagement_change_orders where engagement_id = engagement_record.id and proposed_by_user_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if result.id is not null then return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', true); end if;
  select * into base_terms from public.engagement_terms_versions where id = engagement_record.current_terms_version_id and state = 'accepted';
  select coalesce(sum((item->>'amount_minor')::bigint), 0) into amount_total from jsonb_array_elements(requested_additive_milestones) item;
  candidate := base_terms.terms_snapshot || jsonb_build_object('additive_scope', trim(requested_additive_scope), 'change_order_id', gen_random_uuid(), 'compensation_amount_minor', ((base_terms.terms_snapshot->>'compensation_amount_minor')::bigint + amount_total)::text, 'milestones', base_terms.terms_snapshot->'milestones' || requested_additive_milestones);
  if base_terms.id is null or amount_total <= 0 or not private.engagement_terms_payload_is_valid(engagement_record.engagement_type, candidate) then raise exception 'VALIDATION_FAILED'; end if;
  insert into public.engagement_change_orders (engagement_id, base_terms_version_id, proposed_by_user_id, additive_scope, additive_milestones, additive_amount_minor, idempotency_key)
  values (engagement_record.id, base_terms.id, auth.uid(), trim(requested_additive_scope), requested_additive_milestones, amount_total, requested_idempotency_key) returning * into result;
  perform private.append_engagement_event(engagement_record.id, base_terms.id, null, null, 'change_order.proposed', engagement_record.state, engagement_record.state, requested_idempotency_key, jsonb_build_object('change_order_id', result.id, 'additive_amount_minor', amount_total));
  return jsonb_build_object('change_order_id', result.id, 'state', result.state, 'idempotent', false);
end;
$$;

revoke all on function public.submit_engagement_milestone(uuid, uuid, uuid, text, text, uuid), public.decide_engagement_milestone(uuid, uuid, public.engagement_milestone_decision, text, uuid), public.request_engagement_access(uuid, public.engagement_access_kind, text, text, timestamptz, uuid), public.open_engagement_dispute(uuid, uuid, public.engagement_dispute_category, text, text, uuid[], uuid), public.resolve_engagement_dispute(uuid, text, text, uuid), public.propose_engagement_change_order(uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.submit_engagement_milestone(uuid, uuid, uuid, text, text, uuid), public.decide_engagement_milestone(uuid, uuid, public.engagement_milestone_decision, text, uuid), public.request_engagement_access(uuid, public.engagement_access_kind, text, text, timestamptz, uuid), public.open_engagement_dispute(uuid, uuid, public.engagement_dispute_category, text, text, uuid[], uuid), public.resolve_engagement_dispute(uuid, text, text, uuid), public.propose_engagement_change_order(uuid, text, jsonb, uuid) to authenticated;
