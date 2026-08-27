-- Phase 30 forward integrity hardening.
-- Preserve proof and reputation history with append-only corrections rather than rewrites.

alter type public.proof_graph_relation_type add value if not exists 'person_contributed_to_team_project';
alter type public.proof_graph_relation_type add value if not exists 'reputation_event_changes_contextual_signal';
alter type public.proof_reputation_event_type add value if not exists 'review.finalized';

alter table public.proof_reputation_events
  drop constraint if exists proof_reputation_events_source_event_id_event_type_key;
create unique index proof_reputation_events_source_type_idx
  on public.proof_reputation_events(source_event_id, event_type)
  where event_type <> 'reputation.correction';

create or replace function private.reject_proof_reputation_event_mutation()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'APPEND_ONLY_EVENT_LEDGER';
end;
$$;

drop trigger if exists proof_reputation_events_append_only on public.proof_reputation_events;
create trigger proof_reputation_events_append_only
before update or delete on public.proof_reputation_events
for each row execute function private.reject_proof_reputation_event_mutation();

create or replace function private.record_finalized_verification_review()
returns trigger
language plpgsql security definer set search_path = public, private as $$
declare verification_record public.project_verifications;
begin
  if tg_op = 'UPDATE'
    and old.state not in ('changes_requested', 'verified', 'not_verified')
    and new.state in ('changes_requested', 'verified', 'not_verified')
  then
    select * into verification_record
    from public.project_verifications
    where id = new.verification_id;
    if verification_record.id is not null then
      perform private.append_proof_reputation_event(
        verification_record.talent_user_id, verification_record.organization_id,
        null, null, null, new.id, 'review.finalized', 'review.finalized',
        'restricted',
        'A human reviewer finalized a contextual review. Reviewer-private observations remain restricted.',
        jsonb_build_object('review_state', new.state)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists project_verification_review_reputation_event on public.project_verification_reviews;
create trigger project_verification_review_reputation_event
after update of state on public.project_verification_reviews
for each row execute function private.record_finalized_verification_review();

create or replace function public.append_proof_reputation_correction(
  requested_event_id uuid,
  requested_explanation text,
  requested_idempotency_key uuid
) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  actor_id uuid := auth.uid();
  target_event public.proof_reputation_events;
  correction_id uuid;
begin
  if actor_id is null
    or not private.verification_actor_is_admin()
    or requested_idempotency_key is null
    or char_length(trim(coalesce(requested_explanation, ''))) not between 20 and 480
  then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select * into target_event from public.proof_reputation_events
    where id = requested_event_id for update;
  if target_event.id is null then raise exception 'NOT_FOUND_OR_PRIVATE'; end if;
  select event.id into correction_id
    from public.proof_reputation_events event
    where event.event_type = 'reputation.correction'
      and event.corrected_event_id = target_event.id
      and event.metadata->>'idempotency_key' = requested_idempotency_key::text;
  if correction_id is not null then
    return jsonb_build_object('event_id', correction_id, 'idempotent', true);
  end if;
  insert into public.proof_reputation_events (
    talent_user_id, organization_id, public_proof_id, verification_proof_id,
    source_event_id, source_event_type, event_type, visibility, event_summary,
    metadata, corrected_event_id
  ) values (
    target_event.talent_user_id, target_event.organization_id,
    target_event.public_proof_id, target_event.verification_proof_id,
    target_event.id, 'reputation.correction', 'reputation.correction',
    'restricted', trim(requested_explanation),
    jsonb_build_object('idempotency_key', requested_idempotency_key), target_event.id
  ) returning id into correction_id;
  return jsonb_build_object('event_id', correction_id, 'idempotent', false);
end;
$$;

revoke all on function private.reject_proof_reputation_event_mutation(),
  private.record_finalized_verification_review() from public, anon, authenticated;
revoke all on function public.append_proof_reputation_correction(uuid, text, uuid)
  from public, anon;
grant execute on function public.append_proof_reputation_correction(uuid, text, uuid)
  to authenticated;
