# Phase 34 — Payments launch-market compliance checklist

এই checklistটি **implementation control**, legal advice নয়। Phase 34-এ Proofly কোনো market, provider, tax, employment classification, money-transmission, escrow, or payout eligibility outcome-এর legal determination করে না। Production activation requires a separate accountable review and an approved provider/market decision.

| Control | Phase 34 status | Boundary and evidence |
| --- | --- | --- |
| Provider mode | **Sandbox only** | Server configuration accepts only test-mode Stripe credentials and a server-side webhook secret. Production keys are rejected by configuration parsing. |
| Market readiness | **Fail-closed** | No market/provider approval is seeded. Funding, checkout, release, refund, and payout coordination remain unavailable unless an approved policy record exists. |
| Customer payment data | **Provider-hosted** | Proofly accepts bounded record IDs and reasons, never raw card numbers, bank credentials, tax identifiers, or provider secrets. |
| Webhook authenticity | **Required** | Payment state may change only after raw-body signature verification, durable provider-event recording, idempotency checks, and server-side reconciliation. |
| Client trust | **Prohibited** | Browser redirects and client callbacks are informational only. They cannot mark funding, release, refund, payout, or settlement as verified. |
| Ledger integrity | **Required** | Financial effects are append-only, linked to internal records, and protected by database-level debit/credit balance checks. |
| Refunds and releases | **Pending provider verification** | A request creates an auditable pending record. Provider execution and a matching verified event are required before a financial status is considered complete. |
| Payout eligibility | **Not automatically determined** | Talent payout status depends on provider capability and approved risk/compliance policy. No raw destination or credential is exposed in Proofly. |
| Company billing authority | **Least privilege** | Billing and spend-control operations require an authenticated company billing context; hiring membership alone is insufficient. |
| Reviewer economics | **Policy-disabled** | No Phase 37 foundation is available in this repository. Reviewer earning or payout activation is not seeded or exposed as an active workflow. |
| Disputes and holds | **Human-accountable** | Provider and engagement disputes create private holds/review records. AI does not decide disputes, refunds, releases, payouts, or account actions. |
| Public exposure | **Prohibited** | Payment amounts, receipts, payout destinations, provider payloads, ledger entries, reconciliation details, and private contract terms are not public profile or matching inputs. |
| Data retention and support | **Separate approval required** | Retention, support access, deletion/export handling, incident response, tax reporting, sanctions screening, and regional data-transfer controls require an operational approval before production launch. |
| Production launch gate | **Blocked** | Do not switch to live provider credentials or enable a launch market until provider, legal/compliance, finance operations, security, support, reconciliation, and incident-runbook owners sign off. |

## Required evidence before production activation

Before any production payment or payout activation, the release owner must record the approved provider and market, supported currencies and fee treatment, provider account ownership, webhook endpoint and rotation plan, reconciliation schedule and owner, refund/dispute operating procedure, payout risk and verification policy, privacy/retention assessment, support escalation path, incident response procedure, and an explicit decision on whether the product requires additional licensing or regulated-partner coverage. These items are intentionally **not inferred by the application**.

## Phase 34 implementation statement

Phase 34 provides provider-adapter boundaries, sandbox checkout and onboarding handoffs, verified webhook ingestion, append-only ledger records, guarded release/refund/payout coordination, private financial readers, and restricted reconciliation records. It does not execute a production launch, provide legal advice, promise employment classification, or independently make a final financial, dispute, risk, or account decision.
