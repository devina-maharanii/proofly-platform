-- Phase 33 hardening — participant details need private linked context and immutable version snapshots.

create or replace function public.get_engagement_for_participant(requested_engagement_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, private as $$
declare engagement_record public.engagements; role_record public.engagement_participant_role;
begin
  engagement_record := private.require_engagement_participant(requested_engagement_id);
  role_record := private.engagement_actor_role(engagement_record.id);
  return jsonb_build_object(
    'id', engagement_record.id, 'engagement_type', engagement_record.engagement_type, 'state', engagement_record.state,
    'funding_state', engagement_record.funding_state, 'market_code', engagement_record.market_code, 'currency', engagement_record.currency,
    'project_id', engagement_record.project_id, 'application_id', engagement_record.application_id, 'workspace_id', engagement_record.workspace_id,
    'parent_engagement_id', engagement_record.parent_engagement_id, 'project_title', coalesce((select project.title from public.company_project_drafts project where project.id = engagement_record.project_id), ''),
    'organization_name', coalesce((select organization.name from public.organizations organization where organization.id = engagement_record.organization_id), ''),
    'participant_role', role_record, 'proposal_expires_at', engagement_record.proposal_expires_at,
    'terms', coalesce((select jsonb_build_object('id', version.id, 'version', version.version_number, 'state', version.state, 'snapshot', version.terms_snapshot, 'accepted_at', version.accepted_at) from public.engagement_terms_versions version where version.id = engagement_record.current_terms_version_id), '{}'::jsonb),
    'terms_history', coalesce((select jsonb_agg(jsonb_build_object('id', version.id, 'version', version.version_number, 'state', version.state, 'snapshot', version.terms_snapshot, 'created_at', version.created_at, 'proposed_at', version.proposed_at, 'accepted_at', version.accepted_at, 'superseded_at', version.superseded_at) order by version.version_number desc) from public.engagement_terms_versions version where version.engagement_id = engagement_record.id), '[]'::jsonb),
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

revoke all on function public.get_engagement_for_participant(uuid) from public, anon;
grant execute on function public.get_engagement_for_participant(uuid) to authenticated;
