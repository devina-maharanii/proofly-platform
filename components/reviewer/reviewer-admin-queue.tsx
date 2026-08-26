"use client";

/** Design: Evidence Ledger Editorial — compact private queue rows, mono state labels, and purposeful human decisions rather than dashboard ornament. */
import { useActionState } from "react";

import { resolveReviewerApplicationAction } from "@/lib/reviewer/actions";
import {
  initialReviewerActionState,
  reviewerApplicationStateLabel,
  type ReviewerAdminQueueItem,
} from "@/lib/reviewer/types";
import { canonicalSkillLabel } from "@/lib/profile/types";

const transitions = {
  in_screening: ["needs_more_evidence", "approved", "rejected"],
  needs_more_evidence: ["rejected"],
  approved: ["paused", "suspended"],
  active: ["paused", "suspended"],
  paused: ["active", "suspended"],
  suspended: ["approved"],
  requested: [],
  rejected: [],
} as const;

function ReviewerDecision({
  item,
}: Readonly<{ item: ReviewerAdminQueueItem }>) {
  const [state, action, pending] = useActionState(
    resolveReviewerApplicationAction,
    initialReviewerActionState
  );
  const options = transitions[item.state];
  if (!options.length) return null;
  return (
    <form action={action} className="reviewer-admin-decision">
      <input type="hidden" name="targetUserId" value={item.userId} />
      <label>
        <span>Lifecycle decision</span>
        <select name="requestedState" defaultValue={options[0]}>
          {options.map(nextState => (
            <option key={nextState} value={nextState}>
              {reviewerApplicationStateLabel[nextState]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Reason or requested evidence</span>
        <textarea name="note" maxLength={600} required />
      </label>
      <button
        className="reviewer-primary-button"
        type="submit"
        disabled={pending}
      >
        {pending ? "Recording…" : "Record decision"}
      </button>
      {state.status !== "idle" ? (
        <p
          className="reviewer-status"
          data-status={state.status}
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ReviewerAdminQueue({
  items,
}: Readonly<{ items: readonly ReviewerAdminQueueItem[] }>) {
  return (
    <section
      className="reviewer-admin-queue"
      aria-labelledby="reviewer-admin-queue-title"
    >
      <div className="reviewer-section-heading">
        <p className="reviewer-kicker">Restricted operations</p>
        <h2 id="reviewer-admin-queue-title">Reviewer screening queue</h2>
        <p>
          Only an explicitly active administrator context can load or decide
          these private applications. Company roles cannot grant reviewer trust.
        </p>
      </div>
      {items.length ? (
        <div className="reviewer-admin-list">
          {items.map(item => (
            <article className="reviewer-admin-row" key={item.id}>
              <header>
                <div>
                  <p className="reviewer-record-id">
                    Application · {item.id.slice(0, 8)}
                  </p>
                  <h3>{item.displayName || "Applicant name not provided"}</h3>
                  <p>
                    {item.professionalFocus ||
                      "Professional focus not provided"}
                  </p>
                </div>
                <span className="reviewer-state-chip">
                  {reviewerApplicationStateLabel[item.state]}
                </span>
              </header>
              <dl>
                <div>
                  <dt>Skills</dt>
                  <dd>
                    {item.skillKeys.length
                      ? item.skillKeys.map(canonicalSkillLabel).join(", ")
                      : "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{item.availabilityStatus ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Policy agreement</dt>
                  <dd>{item.policyAgreedAt ? "Recorded" : "Not recorded"}</dd>
                </div>
              </dl>
              <ReviewerDecision item={item} />
            </article>
          ))}
        </div>
      ) : (
        <div className="reviewer-empty-panel">
          <h3>No private reviewer applications need action</h3>
          <p>
            New submissions and actionable more-evidence records will appear
            here after the server confirms an active administrator context.
          </p>
        </div>
      )}
    </section>
  );
}
