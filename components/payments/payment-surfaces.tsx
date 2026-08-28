"use client";

/** Phase 34 Evidence Ledger Editorial surface: private graphite/fog financial records, restrained cobalt actions, no public money data, and explicit provider-verification status. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useActionState, useEffect } from "react";

import type { EngagementDetail } from "@/lib/engagement/types";
import {
  beginEngagementFundingAction,
  beginPayoutOnboardingAction,
  createCompanyBillingProfileAction,
  createPaymentReleaseAction,
  openPlatformPaymentDisputeAction,
  requestPaymentRefundAction,
  runPaymentReconciliationAction,
} from "@/lib/payments/actions";
import {
  initialPaymentActionState,
  money,
  type CompanyBillingOverview,
  type EngagementPaymentStatus,
  type PaymentActionState,
  type PaymentReconciliationQueue,
  type PrivatePayoutStatus,
} from "@/lib/payments/types";

const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(new Date(value))
    : "Not recorded";

function ActionStatus({ state }: Readonly<{ state: PaymentActionState }>) {
  return state.status === "idle" ? null : (
    <p
      className="profile-status"
      data-status={state.status}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

function RefreshOrRedirect({ state }: Readonly<{ state: PaymentActionState }>) {
  const router = useRouter();
  useEffect(() => {
    if (state.status !== "success") return;
    if (state.redirectPath) {
      window.location.assign(state.redirectPath);
      return;
    }
    router.refresh();
  }, [router, state.redirectPath, state.status]);
  return null;
}

export function EngagementPaymentPanel({
  engagement,
  status,
}: Readonly<{
  engagement: EngagementDetail;
  status: EngagementPaymentStatus | null;
}>) {
  const [fundingState, fundingAction] = useActionState(
    beginEngagementFundingAction,
    initialPaymentActionState
  );
  const [payoutState, payoutAction] = useActionState(
    beginPayoutOnboardingAction,
    initialPaymentActionState
  );
  const [releaseState, releaseAction] = useActionState(
    createPaymentReleaseAction,
    initialPaymentActionState
  );
  const [refundState, refundAction] = useActionState(
    requestPaymentRefundAction,
    initialPaymentActionState
  );
  const [disputeState, disputeAction] = useActionState(
    openPlatformPaymentDisputeAction,
    initialPaymentActionState
  );
  const isTalent = engagement.participantRole === "talent";
  const payment = status?.paymentIntent ?? null;
  const fundingEligible = ["accepted", "funding_required"].includes(
    engagement.state
  );
  const releasableMilestones = engagement.milestones.filter(
    milestone => milestone.state === "accepted_for_payment"
  );
  return (
    <section className="profile-section application-detail-section">
      <p className="profile-kicker">Provider-coordinated money record</p>
      <h2>Funding, release, and payout status</h2>
      <p>
        Financial status is private to the authorized billing party and affected
        Talent. Provider webhooks, not browser callbacks, determine funded,
        released, refunded, or paid records. No financial data appears in Proof,
        reputation, matching, or public pages.
      </p>
      {!status ? (
        <p className="profile-empty-copy">
          Financial detail is unavailable from this private role. Billing
          members and the affected Talent have separate, least-privilege views.
        </p>
      ) : (
        <>
          {!status.marketPaymentAvailable ? (
            <p className="profile-proof-boundary">
              <strong>Launch-market hold:</strong> no approved payment/payout
              compliance policy exists for this engagement market. Sandbox
              checkout, payout onboarding, release, and refund execution remain
              blocked; Proofly will not simulate a funded state.
            </p>
          ) : null}
          <dl className="company-public-detail-list">
            <div>
              <dt>Engagement funding record</dt>
              <dd>{status.fundingState.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Payment state</dt>
              <dd>{payment?.state.replaceAll("_", " ") ?? "Not created"}</dd>
            </div>
            <div>
              <dt>Payment hold</dt>
              <dd>
                {status.disputeHold
                  ? "Open hold — provider actions blocked"
                  : "No open payment hold"}
              </dd>
            </div>
            {payment ? (
              <>
                <div>
                  <dt>Compensation</dt>
                  <dd>{money(payment.amountMinor, payment.currency)}</dd>
                </div>
                <div>
                  <dt>Provider-coordinated funding total</dt>
                  <dd>{money(payment.fundingTotalMinor, payment.currency)}</dd>
                </div>
                <div>
                  <dt>Expected Talent net</dt>
                  <dd>
                    {money(payment.expectedTalentNetMinor, payment.currency)}
                  </dd>
                </div>
                <div>
                  <dt>Verified funding timestamp</dt>
                  <dd>{dateText(payment.fundedAt)}</dd>
                </div>
              </>
            ) : null}
          </dl>
          {status.isBillingParty && fundingEligible && !payment ? (
            <form action={fundingAction} className="profile-editor-form">
              <input type="hidden" name="engagementId" value={engagement.id} />
              <button
                className="button button-primary"
                type="submit"
                disabled={!status.marketPaymentAvailable}
              >
                Continue to sandbox checkout
              </button>
              <ActionStatus state={fundingState} />
              <RefreshOrRedirect state={fundingState} />
            </form>
          ) : null}
          {isTalent &&
          [
            "accepted",
            "funding_required",
            "funded",
            "in_progress",
            "submitted",
            "changes_requested",
            "accepted_for_payment",
          ].includes(engagement.state) ? (
            <form action={payoutAction} className="profile-editor-form">
              <input type="hidden" name="engagementId" value={engagement.id} />
              <button
                className="button button-secondary"
                type="submit"
                disabled={!status.marketPaymentAvailable}
              >
                Open sandbox payout onboarding
              </button>
              <p className="profile-helper-text">
                Payout destination details are entered only in the provider’s
                hosted flow and are never stored in Proofly.
              </p>
              <ActionStatus state={payoutState} />
              <RefreshOrRedirect state={payoutState} />
            </form>
          ) : null}
          {status.isBillingParty && payment && releasableMilestones.length ? (
            <section className="profile-section">
              <p className="profile-kicker">Accepted milestone release</p>
              <h3>Request a provider release only after acceptance</h3>
              <p>
                A release is blocked until funding and payout eligibility are
                verified and no payment dispute is open.
              </p>
              {releasableMilestones.map(milestone => (
                <form
                  key={milestone.id}
                  action={releaseAction}
                  className="profile-editor-form"
                >
                  <input
                    type="hidden"
                    name="engagementId"
                    value={engagement.id}
                  />
                  <input
                    type="hidden"
                    name="milestoneId"
                    value={milestone.id}
                  />
                  <button
                    className="button button-secondary"
                    type="submit"
                    disabled={status.disputeHold}
                  >
                    Request provider release for {milestone.title}
                  </button>
                </form>
              ))}
              <ActionStatus state={releaseState} />
              <RefreshOrRedirect state={releaseState} />
            </section>
          ) : null}
          {status.isBillingParty &&
          payment &&
          ["funded", "on_hold"].includes(payment.state) ? (
            <section className="profile-section">
              <p className="profile-kicker">Refund coordination</p>
              <h3>Record a bounded refund request</h3>
              <p>
                This records a private request only. A provider-verified event
                is required before a refund state or receipt is issued.
              </p>
              <form action={refundAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="paymentIntentId"
                  value={payment.id}
                />
                <label>
                  <span>Amount in minor unit</span>
                  <input name="amountMinor" type="number" min="1" required />
                </label>
                <label>
                  <span>Private reason</span>
                  <textarea name="reason" required maxLength={1200} />
                </label>
                <button className="button button-secondary" type="submit">
                  Record refund request
                </button>
                <ActionStatus state={refundState} />
                <RefreshOrRedirect state={refundState} />
              </form>
            </section>
          ) : null}
          {status.isBillingParty &&
          payment &&
          engagement.disputes.some(dispute =>
            ["open", "under_review"].includes(dispute.state)
          ) ? (
            <section className="profile-section">
              <p className="profile-kicker">Payment hold</p>
              <h3>Link the current private dispute</h3>
              <form action={disputeAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="paymentIntentId"
                  value={payment.id}
                />
                <label>
                  <span>Open engagement dispute</span>
                  <select name="engagementDisputeId" required defaultValue="">
                    <option value="" disabled>
                      Select an open private dispute
                    </option>
                    {engagement.disputes
                      .filter(dispute =>
                        ["open", "under_review"].includes(dispute.state)
                      )
                      .map(dispute => (
                        <option key={dispute.id} value={dispute.id}>
                          {dispute.category.replaceAll("_", " ")}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Private reason</span>
                  <textarea name="reason" required maxLength={1600} />
                </label>
                <button className="button button-secondary" type="submit">
                  Record payment hold
                </button>
                <ActionStatus state={disputeState} />
                <RefreshOrRedirect state={disputeState} />
              </form>
            </section>
          ) : null}
          {status.releases.length ? (
            <section className="profile-section">
              <p className="profile-kicker">Release ledger</p>
              <ul className="public-evidence-list application-evidence-receipt">
                {status.releases.map(release => (
                  <li key={release.id}>
                    <strong>{release.state.replaceAll("_", " ")}</strong>
                    <span>
                      {money(release.expectedTalentNetMinor, release.currency)}{" "}
                      expected net · verified {dateText(release.releasedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {status.receipts.length ? (
            <section className="profile-section">
              <p className="profile-kicker">Private receipts</p>
              <ul className="public-evidence-list application-evidence-receipt">
                {status.receipts.map(receipt => (
                  <li key={receipt.id}>
                    <strong>{receipt.statusLabel}</strong>
                    <span>
                      {money(receipt.amountMinor, receipt.currency)} ·{" "}
                      {dateText(receipt.issuedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

export function CompanyBillingOverviewView({
  overview,
}: Readonly<{ overview: CompanyBillingOverview | null }>) {
  const [state, action] = useActionState(
    createCompanyBillingProfileAction,
    initialPaymentActionState
  );
  return (
    <section className="profile-section">
      <p className="profile-kicker">Company billing</p>
      <h2>Authorized payer and spend controls</h2>
      {!overview ? (
        <p className="profile-empty-copy">
          Switch to a company context with billing authority to view this
          private financial record.
        </p>
      ) : (
        <>
          <p className="profile-proof-boundary">
            <strong>Sandbox only:</strong> no payment provider or launch market
            is configured for activation. No financial status is public, and
            provider verification remains the sole source of settlement truth.
          </p>
          <dl className="company-public-detail-list">
            <div>
              <dt>Billing profile</dt>
              <dd>{overview.billingProfile?.status ?? "Not prepared"}</dd>
            </div>
            <div>
              <dt>Authorized payer</dt>
              <dd>
                {overview.billingProfile?.isAuthorizedPayer
                  ? "Current billing user"
                  : "Another authorized payer"}
              </dd>
            </div>
            <div>
              <dt>Spend controls</dt>
              <dd>
                {overview.spendControls.length
                  ? `${overview.spendControls.length} active private control(s)`
                  : "No active control recorded"}
              </dd>
            </div>
          </dl>
          {!overview.billingProfile ? (
            <form action={action} className="profile-editor-form">
              <button className="button button-primary" type="submit">
                Prepare private billing profile
              </button>
              <ActionStatus state={state} />
              <RefreshOrRedirect state={state} />
            </form>
          ) : null}
          {overview.payments.length ? (
            <ul className="public-evidence-list application-evidence-receipt">
              {overview.payments.map(payment => (
                <li key={payment.id}>
                  <Link href={`/engagements/${payment.engagementId}` as Route}>
                    {payment.state.replaceAll("_", " ")} ·{" "}
                    {money(payment.fundingTotalMinor, payment.currency)}
                  </Link>
                  <span>
                    Created {dateText(payment.createdAt)} · funded{" "}
                    {dateText(payment.fundedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              No private payment intents are recorded for this organization.
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function PayoutStatusView({
  status,
}: Readonly<{ status: PrivatePayoutStatus | null }>) {
  return (
    <section className="profile-section">
      <p className="profile-kicker">Talent payout status</p>
      <h2>Provider-held payout eligibility</h2>
      {!status ? (
        <p className="profile-empty-copy">
          Switch to your Talent context to view private payout status.
        </p>
      ) : (
        <>
          <p className="profile-proof-boundary">
            <strong>Sandbox only:</strong> {status.payoutDestinationDisclosure}
          </p>
          {status.payoutAccounts.length ? (
            <ul className="public-evidence-list application-evidence-receipt">
              {status.payoutAccounts.map(account => (
                <li key={account.id}>
                  <strong>{account.state.replaceAll("_", " ")}</strong>
                  <span>
                    {account.requirementsStatusCode ||
                      "Provider requirements not yet verified"}{" "}
                    · {dateText(account.lastVerifiedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              No payout onboarding record exists. Start only from an eligible
              private engagement.
            </p>
          )}
          {status.payouts.length ? (
            <section className="profile-section">
              <p className="profile-kicker">Verified provider payouts</p>
              <ul className="public-evidence-list application-evidence-receipt">
                {status.payouts.map(payout => (
                  <li key={payout.id}>
                    <strong>{payout.state.replaceAll("_", " ")}</strong>
                    <span>
                      {money(payout.amountMinor, payout.currency)} ·{" "}
                      {dateText(payout.paidAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

export function PaymentReconciliationQueueView({
  queue,
}: Readonly<{ queue: PaymentReconciliationQueue | null }>) {
  const [state, action] = useActionState(
    runPaymentReconciliationAction,
    initialPaymentActionState
  );
  return (
    <section className="profile-section">
      <p className="profile-kicker">Restricted operations</p>
      <h2>Payment reconciliation and dead-letter review</h2>
      {!queue ? (
        <p className="profile-empty-copy">
          Administrator context is required. Provider payloads and financial
          identities stay unavailable from this route.
        </p>
      ) : (
        <>
          <p className="profile-proof-boundary">
            <strong>Human review required:</strong> reconciliation records
            support investigation; they cannot silently mark an engagement paid,
            approve a payout, or decide a dispute.
          </p>
          <form action={action} className="profile-editor-form">
            <button className="button button-secondary" type="submit">
              Run sandbox reconciliation
            </button>
            <ActionStatus state={state} />
            <RefreshOrRedirect state={state} />
          </form>
          <dl className="company-public-detail-list">
            <div>
              <dt>Recent reconciliation runs</dt>
              <dd>{queue.runs.length}</dd>
            </div>
            <div>
              <dt>Unresolved items</dt>
              <dd>{queue.items.length}</dd>
            </div>
            <div>
              <dt>Dead letters</dt>
              <dd>{queue.deadLetters.length}</dd>
            </div>
          </dl>
          {queue.items.length ? (
            <ul className="public-evidence-list application-evidence-receipt">
              {queue.items.map(item => (
                <li key={item.id}>
                  <strong>{item.state.replaceAll("_", " ")}</strong>
                  <span>
                    {item.reasonCode} · {dateText(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              No unresolved reconciliation item is visible.
            </p>
          )}
          {queue.deadLetters.length ? (
            <ul className="public-evidence-list application-evidence-receipt">
              {queue.deadLetters.map(event => (
                <li key={event.id}>
                  <strong>
                    {event.normalizedEventType.replaceAll("_", " ")}
                  </strong>
                  <span>
                    {event.failureCode || "Review required"} · attempt{" "}
                    {event.retryCount}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
