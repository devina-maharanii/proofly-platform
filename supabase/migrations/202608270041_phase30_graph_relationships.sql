-- Phase 30 relationship completion.
-- Add source-linked team contribution and reputation-event edges without exposing private activity.

create or replace function private.record_public_team_contribution()
returns trigger
language plpgsql security definer set search_path = public as $$
declare item public.work_evidence_items;
declare publication public.work_evidence_publications;
begin
  if tg_op in ('INSERT', 'UPDATE') and new.is_public then
    select * into item from public.work_evidence_items where id = new.evidence_id;
    select * into publication from public.work_evidence_publications
      where evidence_id = new.evidence_id and state = 'published';
    if item.id is not null and publication.evidence_id is not null and item.team_work then
      insert into public.proof_graph_relations (
        talent_user_id, evidence_id, relation_type, verification_state,
        visibility, source_event_id, source_event_type
      ) values (
        item.user_id, item.id, 'person_contributed_to_team_project', 'contextual',
        'public', new.id, 'work_evidence.attribution.published'
      ) on conflict do nothing;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists work_evidence_public_team_contribution on public.work_evidence_attributions;
create trigger work_evidence_public_team_contribution
after insert or update of is_public on public.work_evidence_attributions
for each row execute function private.record_public_team_contribution();

create or replace function private.record_reputation_event_graph_edge()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.public_proof_id is not null and new.visibility = 'public' then
    insert into public.proof_graph_relations (
      talent_user_id, organization_id, public_proof_id, verification_proof_id,
      relation_type, verification_state, visibility, source_event_id, source_event_type
    ) values (
      new.talent_user_id, new.organization_id, new.public_proof_id,
      new.verification_proof_id, 'reputation_event_changes_contextual_signal',
      case when new.event_type in ('proof.verified', 'proof.published')
        then 'human_verified'::public.proof_graph_verification_state
        else 'contextual'::public.proof_graph_verification_state
      end,
      'public', new.id, 'proof_reputation_event'
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists proof_reputation_event_graph_edge on public.proof_reputation_events;
create trigger proof_reputation_event_graph_edge
after insert on public.proof_reputation_events
for each row execute function private.record_reputation_event_graph_edge();

create or replace function private.require_consented_outcome_for_endorsement()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.proof_company_outcomes outcome
    where outcome.public_proof_id = new.public_proof_id
      and outcome.organization_id = new.organization_id
      and outcome.talent_user_id = new.talent_user_id
      and outcome.state = 'consented'
  ) then
    raise exception 'INVALID_STATE';
  end if;
  return new;
end;
$$;

drop trigger if exists proof_endorsement_requires_consented_outcome on public.proof_endorsements;
create trigger proof_endorsement_requires_consented_outcome
before insert on public.proof_endorsements
for each row execute function private.require_consented_outcome_for_endorsement();

revoke all on function private.record_public_team_contribution(),
  private.record_reputation_event_graph_edge(), private.require_consented_outcome_for_endorsement()
  from public, anon, authenticated;
