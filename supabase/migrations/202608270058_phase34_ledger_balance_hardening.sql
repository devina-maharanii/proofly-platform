-- Phase 34 — Enforce balanced, append-only financial operations.

create or replace function private.assert_payment_ledger_operation_balanced()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare debit_total bigint; credit_total bigint;
begin
  select
    coalesce(sum(case when entry.direction = 'debit' then entry.amount_minor else 0 end), 0),
    coalesce(sum(case when entry.direction = 'credit' then entry.amount_minor else 0 end), 0)
  into debit_total, credit_total
  from public.payment_ledger_entries entry
  where entry.operation_id = new.operation_id;
  if debit_total <> credit_total then
    raise exception 'UNBALANCED_LEDGER_OPERATION';
  end if;
  return null;
end;
$$;

create constraint trigger payment_ledger_entries_balanced_after_write
after insert on public.payment_ledger_entries
deferrable initially deferred
for each row execute function private.assert_payment_ledger_operation_balanced();

revoke all on function private.assert_payment_ledger_operation_balanced() from public, anon, authenticated;
