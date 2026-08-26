/** Design: Evidence Ledger Editorial — quiet, explicit eligibility states instead of fabricated opportunity cards or opaque reviewer status. */
import Link from "next/link";
import type { Route } from "next";

import type { ReviewerOpportunityGuard as ReviewerOpportunityGuardState } from "@/lib/reviewer/types";

const copy = {
  application_required: [
    "Complete a reviewer application",
    "Add private professional context, canonical expertise, practical evidence, conflict declarations, and the current conduct agreement before human screening can begin.",
  ],
  approval_pending: [
    "Approval is still in progress",
    "Available review opportunities are held until a human administrator completes the private screening process.",
  ],
  activation_required: [
    "Activate approved reviewer access",
    "Approval is recorded. Activate the reviewer context before eligible opportunities can be considered.",
  ],
  paused: [
    "Reviewer access is paused",
    "New review opportunities are unavailable while access is paused. Existing private materials are not exposed by this page.",
  ],
  suspended: [
    "Reviewer access is suspended",
    "Review opportunities and private material access are unavailable under the current policy state.",
  ],
  not_approved: [
    "Reviewer access is not approved",
    "No review opportunities are available in this application state.",
  ],
  active_reviewer: [
    "No eligible review opportunities are available",
    "The reviewer context is active. Opportunities appear only after exact skill, conflict, organization relationship, capacity, and explicit material-access checks pass.",
  ],
} as const;

export function ReviewerOpportunityGuard({
  guard,
}: Readonly<{ guard: ReviewerOpportunityGuardState }>) {
  const [title, description] = copy[guard.reason];
  return (
    <section
      className="reviewer-opportunity-guard"
      aria-labelledby="reviewer-opportunity-title"
    >
      <p className="reviewer-kicker">Reviewer opportunities</p>
      <h1 id="reviewer-opportunity-title">{title}</h1>
      <p>{description}</p>
      <div className="reviewer-guard-ledger">
        <span>Source</span>
        <strong>Server-derived reviewer lifecycle and access checks</strong>
        <span>Limits</span>
        <strong>
          No scoring, assignments, review decisions, payout, reputation, or AI
          assistance is available here.
        </strong>
      </div>
      {!guard.allowed ? (
        <Link
          className="reviewer-primary-button reviewer-link-button"
          href={"/reviewer/application" as Route}
        >
          Review private application
        </Link>
      ) : null}
    </section>
  );
}
