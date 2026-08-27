"use client";

/** Evidence Ledger Editorial — calm, dense Phase 29 workflow panels show exact source versions and accountable human actions, never a score or automated verdict. */
import Link from "next/link";
import type { Route } from "next";
import { useActionState, useMemo, useState } from "react";

import {
  appealProjectVerificationAction,
  assignProjectVerificationReviewerAction,
  beginProjectVerificationReviewAction,
  decideProjectVerificationReviewAction,
  publishVerifiedProofAction,
  prepareProjectVerificationAction,
} from "@/lib/verification/actions";
import {
  initialVerificationActionState,
  verificationStateLabel,
  type VerificationRecord,
  type VerificationReviewerCandidate,
  type VerificationReview,
  type TalentEvidencePublicationChoice,
} from "@/lib/verification/types";
import type {
  LockedWorkspaceRubric,
  WorkspaceAccessRole,
} from "@/lib/workspace/types";

const message = (state: { status: string; message: string }) =>
  state.status === "idle" ? null : (
    <p className="profile-status" data-status={state.status} role="status">
      {state.message}
    </p>
  );

const humanize = (value: string) => value.replaceAll("_", " ");

export function VerificationWorkspacePanel({
  workspaceId,
  accessRole,
  submissionState,
  verification,
  candidates,
  lockedRubric,
  evidenceChoices,
}: Readonly<{
  workspaceId: string;
  accessRole: WorkspaceAccessRole;
  submissionState: string | null;
  verification: VerificationRecord | null;
  candidates: readonly VerificationReviewerCandidate[];
  lockedRubric: LockedWorkspaceRubric | null;
  evidenceChoices: readonly TalentEvidencePublicationChoice[];
}>) {
  const [prepareState, prepareAction] = useActionState(
    prepareProjectVerificationAction,
    initialVerificationActionState
  );
  const [assignState, assignAction] = useActionState(
    assignProjectVerificationReviewerAction,
    initialVerificationActionState
  );
  const [appealState, appealAction] = useActionState(
    appealProjectVerificationAction,
    initialVerificationActionState
  );
  const [publishState, publishAction] = useActionState(
    publishVerifiedProofAction,
    initialVerificationActionState
  );
  const reviews = verification?.reviews ?? [];
  const latest = reviews.at(-1);
  const changes = (latest?.observations ?? [])
    .filter(item => item.sharedFeedback || item.observation)
    .map(item => ({
      ...item,
      dimensionName:
        lockedRubric?.dimensions.find(
          dimension => dimension.id === item.rubricDimensionId
        )?.name ?? "Locked rubric dimension",
    }));
  return (
    <section className="profile-section" id="verification">
      <div className="profile-section-heading">
        <p className="profile-index">03 · Verification</p>
        <h2>Human accountability for one exact submission</h2>
        <p>
          Verification is bound to one immutable submission version and one
          locked rubric version. It has no universal score, automated decision,
          or public visibility default.
        </p>
      </div>
      {verification ? (
        <div className="workspace-submission-preview">
          <h3>{verificationStateLabel[verification.state]}</h3>
          <p>
            <strong>Submission source:</strong>{" "}
            {verification.submissionVersionId}
          </p>
          <p>
            <strong>Locked rubric source:</strong>{" "}
            {verification.rubricVersionId}
          </p>
          {latest?.decisionSummary ? (
            <p>
              <strong>Human decision record:</strong> {latest.decisionSummary}
            </p>
          ) : null}
          {verification.state === "verified" ? (
            <p>
              This verified record is private by default. No reviewer action
              makes it public.
            </p>
          ) : null}
          {verification.state === "revoked" ? (
            <p>
              Public availability was removed. Restricted audit history remains
              private.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="profile-empty-copy">
          No verification record is prepared. A submitted, complete private
          package and locked rubric are required before assignment.
        </p>
      )}

      {accessRole === "company_participant" &&
      (!verification || verification.state === "changes_requested") &&
      ["submitted", "resubmitted"].includes(submissionState ?? "") ? (
        <form className="workspace-compact-form" action={prepareAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <h3>Prepare human verification</h3>
          <p>
            This checks the exact submitted version and locked rubric. It does
            not decide the outcome or permit a company to choose it.
          </p>
          <button className="button button-secondary" type="submit">
            Prepare for qualified assignment
          </button>
          {message(prepareState)}
        </form>
      ) : null}

      {accessRole === "company_participant" &&
      verification &&
      ["ready_for_assignment", "resubmitted"].includes(verification.state) ? (
        <form className="workspace-compact-form" action={assignAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="verificationId" value={verification.id} />
          <h3>Assign a qualified reviewer</h3>
          <p>
            Eligibility is rechecked server-side for active context, canonical
            expertise, capacity, conflicts, self-review, and organization
            relationships. The company cannot choose the review decision.
          </p>
          <label>
            <span>Qualified reviewer</span>
            <select name="reviewerUserId" required defaultValue="">
              <option value="" disabled>
                Select an eligible reviewer
              </option>
              {candidates.map(candidate => (
                <option value={candidate.userId} key={candidate.userId}>
                  {candidate.displayName} · {candidate.skillKeys.join(", ")}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            type="submit"
            disabled={candidates.length === 0}
          >
            Record reviewer assignment
          </button>
          {candidates.length === 0 ? (
            <p className="profile-empty-copy">
              No eligible reviewer is available in the current private context.
            </p>
          ) : null}
          {message(assignState)}
        </form>
      ) : null}

      {accessRole === "reviewer" && verification && latest ? (
        <p>
          <Link
            className="button button-secondary"
            href={`/reviewer/verifications/${workspaceId}` as Route}
          >
            Open assigned human review
          </Link>
        </p>
      ) : null}

      {accessRole === "talent_participant" &&
      verification?.state === "changes_requested" ? (
        <div className="workspace-submission-preview">
          <h3>Actionable changes requested</h3>
          <p>
            Save a new immutable submission version below, then resubmit it. The
            original review and version stay retained.
          </p>
          {changes.map(item => (
            <article key={item.rubricDimensionId}>
              <h4>{item.dimensionName}</h4>
              <p>{item.sharedFeedback || item.observation}</p>
            </article>
          ))}
        </div>
      ) : null}
      {accessRole === "talent_participant" &&
      verification?.state === "not_verified" &&
      !verification.appeal ? (
        <form className="workspace-compact-form" action={appealAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="verificationId" value={verification.id} />
          <h3>Request a separate appeal</h3>
          <p>
            An appeal does not overwrite the original decision. It creates a
            restricted record for a separately assigned qualified reviewer.
          </p>
          <label>
            <span>Appeal reason</span>
            <textarea
              name="reason"
              minLength={30}
              maxLength={1800}
              rows={5}
              required
            />
          </label>
          <button className="button button-secondary" type="submit">
            Record appeal request
          </button>
          {message(appealState)}
        </form>
      ) : null}
      {accessRole === "talent_participant" &&
      verification?.state === "verified" &&
      verification.proofVisibility === "private" ? (
        <form className="workspace-compact-form" action={publishAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="verificationId" value={verification.id} />
          <h3>Choose public Proof visibility</h3>
          <p>
            This is your separate visibility decision. It links one of your
            existing published evidence records to the verified submission and
            locked rubric; it never reveals reviewer-private notes.
          </p>
          <label>
            <span>Published evidence record</span>
            <select name="evidenceId" defaultValue="" required>
              <option value="" disabled>
                Select your published evidence
              </option>
              {evidenceChoices.map(evidence => (
                <option key={evidence.evidenceId} value={evidence.evidenceId}>
                  {evidence.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Verified skill</span>
            <select name="skillKey" defaultValue="" required>
              <option value="" disabled>
                Select a rubric-bound skill
              </option>
              {verification.decision?.verifiedSkillKeys.map(skillKey => (
                <option key={skillKey} value={skillKey}>
                  {skillKey}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            type="submit"
            disabled={
              !evidenceChoices.length ||
              !verification.decision?.verifiedSkillKeys.length
            }
          >
            Make this Proof public
          </button>
          {!evidenceChoices.length ? (
            <p className="profile-empty-copy">
              Publish a work-evidence record first if you want to make this
              Proof public. It remains private otherwise.
            </p>
          ) : null}
          {message(publishState)}
        </form>
      ) : null}
    </section>
  );
}

export function ReviewerVerificationDetail({
  workspaceId,
  verification,
  lockedRubric,
}: Readonly<{
  workspaceId: string;
  verification: VerificationRecord;
  lockedRubric: LockedWorkspaceRubric | null;
}>) {
  const review =
    verification.reviews.find(
      item => item.state === "assigned" || item.state === "under_review"
    ) ?? null;
  const [startState, startAction] = useActionState(
    beginProjectVerificationReviewAction,
    initialVerificationActionState
  );
  if (
    !review ||
    !lockedRubric ||
    lockedRubric.rubricVersionId !== verification.rubricVersionId
  ) {
    return (
      <section className="profile-section">
        <h2>Assigned review unavailable</h2>
        <p>
          The assigned record, exact locked rubric, and review material
          authorization must all remain available before any observation can be
          recorded.
        </p>
      </section>
    );
  }
  return review.state === "assigned" ? (
    <section className="profile-section">
      <h2>Start assigned human review</h2>
      <p>
        Starting confirms review of the exact private submission version against
        the locked rubric. It does not create a decision.
      </p>
      <form className="workspace-compact-form" action={startAction}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="reviewId" value={review.id} />
        <button className="button button-primary" type="submit">
          Start human review
        </button>
        {message(startState)}
      </form>
    </section>
  ) : (
    <ReviewerDecisionForm
      workspaceId={workspaceId}
      verification={verification}
      review={review}
      lockedRubric={lockedRubric}
    />
  );
}

function ReviewerDecisionForm({
  workspaceId,
  verification,
  review,
  lockedRubric,
}: Readonly<{
  workspaceId: string;
  verification: VerificationRecord;
  review: VerificationReview;
  lockedRubric: LockedWorkspaceRubric;
}>) {
  const initial = useMemo(
    () =>
      lockedRubric.dimensions.map(dimension => ({
        rubricDimensionId: dimension.id,
        selectedDescriptorLevel: "working_in_context",
        observation: "",
        sharedFeedback: "",
        privateNote: "",
      })),
    [lockedRubric.dimensions]
  );
  const [observations, setObservations] = useState(initial);
  const [state, action] = useActionState(
    decideProjectVerificationReviewAction,
    initialVerificationActionState
  );
  const update = (
    index: number,
    key: keyof (typeof observations)[number],
    value: string
  ) =>
    setObservations(previous =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  return (
    <section className="profile-section">
      <div className="profile-section-heading">
        <p className="profile-index">Human decision record</p>
        <h2>Observe every locked rubric dimension</h2>
        <p>
          Write evidence-grounded observations. The final decision is yours
          alone and is recorded with accountability; it cannot be selected by AI
          or a client status field.
        </p>
      </div>
      <form className="workspace-submission-form" action={action}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="verificationId" value={verification.id} />
        <input type="hidden" name="reviewId" value={review.id} />
        <input
          type="hidden"
          name="observations"
          value={JSON.stringify(observations)}
        />
        {lockedRubric.dimensions.map((dimension, index) => (
          <fieldset key={dimension.id}>
            <legend>
              {dimension.position}. {dimension.name} · locked rubric
            </legend>
            <p>{dimension.description}</p>
            <label>
              <span>Descriptor</span>
              <select
                value={observations[index]?.selectedDescriptorLevel}
                onChange={event =>
                  update(index, "selectedDescriptorLevel", event.target.value)
                }
              >
                {dimension.descriptors.map(descriptor => (
                  <option value={descriptor.level} key={descriptor.level}>
                    {humanize(descriptor.level)} — {descriptor.description}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Human observation</span>
              <textarea
                minLength={20}
                maxLength={1400}
                rows={4}
                required
                value={observations[index]?.observation}
                onChange={event =>
                  update(index, "observation", event.target.value)
                }
              />
            </label>
            <label>
              <span>
                Shared feedback ({humanize(dimension.feedbackVisibility)})
              </span>
              <textarea
                maxLength={1400}
                rows={3}
                value={observations[index]?.sharedFeedback}
                onChange={event =>
                  update(index, "sharedFeedback", event.target.value)
                }
              />
            </label>
            <label>
              <span>Reviewer-private note</span>
              <textarea
                maxLength={1400}
                rows={3}
                value={observations[index]?.privateNote}
                onChange={event =>
                  update(index, "privateNote", event.target.value)
                }
              />
            </label>
          </fieldset>
        ))}
        <label>
          <span>Human decision</span>
          <select name="decision" defaultValue="changes_requested">
            <option value="changes_requested">Changes requested</option>
            <option value="verified">Verified</option>
            <option value="not_verified">Not verified</option>
          </select>
        </label>
        <label>
          <span>Decision summary</span>
          <textarea
            name="decisionSummary"
            minLength={20}
            maxLength={1600}
            rows={4}
            required
          />
        </label>
        <label>
          <span>Actionable next steps (required for changes requested)</span>
          <textarea name="actionableNextSteps" maxLength={1600} rows={4} />
        </label>
        <label>
          <span>
            Reviewer attribution if the Talent later chooses public proof
            visibility
          </span>
          <select name="reviewerAttributionMode" defaultValue="withhold_name">
            <option value="withhold_name">Withhold my name</option>
            <option value="display_name">Allow display name</option>
          </select>
        </label>
        <button className="button button-primary" type="submit">
          Record human decision
        </button>
        {message(state)}
      </form>
    </section>
  );
}
