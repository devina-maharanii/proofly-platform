-- Phase 34 — Explicitly remove default authenticated execution from service-only reconciliation internals.

revoke execute on function public.get_payment_reconciliation_execution_context(uuid),
  public.record_payment_reconciliation_item(uuid, uuid, public.payment_reconciliation_state, text),
  public.complete_payment_reconciliation_run(uuid, text)
from authenticated;

grant execute on function public.get_payment_reconciliation_execution_context(uuid),
  public.record_payment_reconciliation_item(uuid, uuid, public.payment_reconciliation_state, text),
  public.complete_payment_reconciliation_run(uuid, text)
to service_role;
