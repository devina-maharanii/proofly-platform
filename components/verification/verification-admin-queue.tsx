"use client";

/** Evidence Ledger Editorial — a restricted Phase 29 administrator ledger for appeal allocation and revocation only; it never permits an administrator to author a reviewer decision. */
import { useActionState } from "react";

import {
  assignProjectVerificationAppealAction,
  revokeProjectVerificationAction,
} from "@/lib/verification/actions";
import {
  initialVerificationActionState,
  verificationStateLabel,
  type AdminVerificationQueueItem,
  type VerificationReviewerCandidate,
} from "@/lib/verification/types";

const status = (value: { status: string; message: string }) =>
  value.status === "idle" ? null : (
    <p className="profile-status" data-status={value.status} role="status">
      {value.message}
    </p>
  );

function AppealAssignment({
  item,
  candidates,
}: Readonly<{
  item: AdminVerificationQueueItem;
  candidates: readonly VerificationReviewerCandidate[];
}>) {
  const [state, action] = useActionState(
    assignProjectVerificationAppealAction,
    initialVerificationActionState
  );
  if (item.appealState !== "requested") return null;
  return (
    <form className="workspace-compact-form" action={action}>
      <input type="hidden" name="workspaceId" value={item.workspaceId} />
      <input type="hidden" name="verificationId" value={item.id} />
      <label>
        <span>Separate qualified reviewer</span>
        <select name="reviewerUserId" defaultValue="" required>
          <option value="" disabled>
            Select an eligible reviewer
          </option>
          {candidates.map(candidate => (
            <option key={candidate.userId} value={candidate.userId}>
              {candidate.displayName} · {candidate.skillKeys.join(", ")}
            </option>
          ))}
        </select>
      </label>
      <button
        className="button button-secondary"
        type="submit"
        disabled={!candidates.length}
      >
        Assign appeal reviewer
      </button>
      {!candidates.length ? (
        <p className="profile-empty-copy">
          No separately eligible reviewer is currently available.
        </p>
      ) : null}
      {status(state)}
    </form>
  );
}

function Revocation({ item }: Readonly<{ item: AdminVerificationQueueItem }>) {
  const [state, action] = useActionState(
    revokeProjectVerificationAction,
    initialVerificationActionState
  );
  if (!item.canRevoke) return null;
  return (
    <form className="workspace-compact-form" action={action}>
      <input type="hidden" name="workspaceId" value={item.workspaceId} />
      <input type="hidden" name="verificationId" value={item.id} />
      <label>
        <span>Accountable revocation reason</span>
        <select name="reason" defaultValue="incorrect_attribution">
          <option value="fraud">Fraud</option>
          <option value="incorrect_attribution">Incorrect attribution</option>
          <option value="policy_breach">Policy breach</option>
          <option value="material_change">Material change</option>
        </select>
      </label>
      <label>
        <span>Restricted audit note</span>
        <textarea
          name="note"
          minLength={20}
          maxLength={1600}
          rows={4}
          required
        />
      </label>
      <button className="button button-secondary" type="submit">
        Revoke verification and remove public Proof
      </button>
      {status(state)}
    </form>
  );
}

export function VerificationAdminQueue({
  items,
  candidatesByVerification,
}: Readonly<{
  items: readonly AdminVerificationQueueItem[];
  candidatesByVerification: Readonly<
    Record<string, readonly VerificationReviewerCandidate[]>
  >;
}>) {
  return (
    <section className="profile-section">
      <div className="profile-section-heading">
        <p className="profile-index">Restricted operations</p>
        <h2>Verification accountability ledger</h2>
        <p>
          Only an active administrator context can access this limited record.
          Administrators allocate appeal reviewers and revoke verified records
          with a reason; they do not author reviewer decisions.
        </p>
      </div>
      {items.length ? (
        <div className="reviewer-admin-list">
          {items.map(item => (
            <article className="reviewer-admin-row" key={item.id}>
              <header>
                <div>
                  <p className="reviewer-record-id">
                    Verification · {item.id.slice(0, 8)}
                  </p>
                  <h3>{verificationStateLabel[item.state]}</h3>
                  <p>
                    Exact submission version ·{" "}
                    {item.submissionVersionId.slice(0, 8)}
                  </p>
                </div>
                <span className="reviewer-state-chip">
                  {item.appealState
                    ? `Appeal ${item.appealState}`
                    : "No appeal"}
                </span>
              </header>
              <AppealAssignment
                item={item}
                candidates={candidatesByVerification[item.id] ?? []}
              />
              <Revocation item={item} />
            </article>
          ))}
        </div>
      ) : (
        <p className="profile-empty-copy">
          No private verification records require administrator action.
        </p>
      )}
    </section>
  );
}
