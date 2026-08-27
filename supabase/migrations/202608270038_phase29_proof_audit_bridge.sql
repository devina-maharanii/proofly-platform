-- Phase 29 proof audit bridge.
-- Ensures the narrow Talent publication and administrator revocation commands append
-- the established Proof audit history while direct table access remains revoked.
-- Rollback: forward compensation only; audit rows are retained as security history.

create or replace function private.audit_verified_proof_publication()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.verification_id is not null and new.status = 'verified' then
    insert into public.talent_public_proof_events (proof_id, actor_user_id, event_type)
      values (new.id, auth.uid(), 'proof.verified');
  elsif tg_op = 'UPDATE'
    and new.verification_id is not null
    and old.status = 'verified'
    and new.status = 'revoked'
  then
    insert into public.talent_public_proof_events (proof_id, actor_user_id, event_type)
      values (new.id, auth.uid(), 'proof.revoked');
  end if;
  return new;
end;
$$;

drop trigger if exists talent_public_proofs_verification_audit on public.talent_public_proofs;
create trigger talent_public_proofs_verification_audit
after insert or update of status on public.talent_public_proofs
for each row execute function private.audit_verified_proof_publication();

revoke all on function private.audit_verified_proof_publication() from public, anon, authenticated;
