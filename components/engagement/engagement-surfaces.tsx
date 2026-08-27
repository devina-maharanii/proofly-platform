"use client";

/** Phase 33 Evidence Ledger Editorial surface: graphite and fog private records, restrained cobalt actions, dense semantic forms, and no dashboard-feed or public contract language. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useActionState, useEffect } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import type { CompanyApplicationReceipt } from "@/lib/application/types";
import {
  acceptEngagementTermsAction,
  cancelEngagementAction,
  createEngagementProposalAction,
  decideEngagementMilestoneAction,
  grantEngagementAccessAction,
  openEngagementDisputeAction,
  recordEngagementNegotiationAction,
  requestEngagementAccessAction,
  resolveEngagementDisputeAction,
  revokeEngagementAccessAction,
  submitEngagementMilestoneAction,
  terminateEngagementAction,
} from "@/lib/engagement/actions";
import {
  engagementPath,
  engagementStateLabel,
  engagementTypeLabel,
  initialEngagementActionState,
  type EngagementActionState,
  type EngagementDetail,
  type EngagementDisputeQueueItem,
  type EngagementListItem,
  type EngagementMarketOption,
} from "@/lib/engagement/types";

const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(new Date(value))
    : "Not recorded";

const text = (value: unknown, fallback = "Not stated") =>
  typeof value === "string" && value.trim() ? value : fallback;

const money = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);

function Status({ state }: Readonly<{ state: EngagementActionState }>) {
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

function RefreshOnSuccess({
  state,
}: Readonly<{ state: EngagementActionState }>) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return null;
}

export function EngagementListView({
  activeRole,
  engagements,
}: Readonly<{ activeRole: string | null; engagements: EngagementListItem[] }>) {
  const canView = activeRole === "talent" || activeRole === "company_member";
  return (
    <AuthShell
      eyebrow="Private engagements"
      title="Terms, work, and exceptions in one accountable record"
      description="Engagements are visible only to their participants. Proofly records the agreed scope and human actions; it does not make legal, employment, hiring, or payment decisions."
    >
      <nav className="profile-nav" aria-label="Engagement navigation">
        <Link href="/applications">Applications</Link>
        <Link href={"/workspaces" as Route}>Workspaces</Link>
        <Link href={"/engagements" as Route} aria-current="page">
          Engagements
        </Link>
      </nav>
      {!canView ? (
        <section className="profile-empty-state">
          <p className="profile-kicker">Context required</p>
          <h2>Switch to Talent or an authorized company context</h2>
          <p>
            Engagement records cannot be shown from a reviewer or administrator
            context. This prevents private terms from crossing role boundaries.
          </p>
          <Link className="button button-primary" href="/auth/continue">
            Choose a context
          </Link>
        </section>
      ) : engagements.length ? (
        <ul className="evidence-owner-list application-owner-list">
          {engagements.map(item => (
            <li key={item.id}>
              <div>
                <p className="profile-kicker">
                  {engagementTypeLabel(item.engagementType)} ·{" "}
                  {engagementStateLabel(item.state)}
                </p>
                <h3>{item.projectTitle || "Private project"}</h3>
                {item.organizationName ? <p>{item.organizationName}</p> : null}
                <small>
                  Funding record: {item.fundingState.replaceAll("_", " ")}
                </small>
                <small>Last updated: {dateText(item.updatedAt)}</small>
              </div>
              <Link
                className="button button-secondary"
                href={engagementPath(item.id) as Route}
              >
                Open private record
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="profile-empty-state">
          <p className="profile-kicker">No private engagements</p>
          <h2>No paid work record is active in this context</h2>
          <p>
            Company members may begin only from an eligible private application
            and an approved market/provider policy. Talent never creates a
            company-origin proposal.
          </p>
          {activeRole === "company_member" ? (
            <Link
              className="button button-primary"
              href={"/company/projects/new" as Route}
            >
              Open company project records
            </Link>
          ) : (
            <Link
              className="button button-primary"
              href={"/applications" as Route}
            >
              Open applications
            </Link>
          )}
        </section>
      )}
    </AuthShell>
  );
}

export function CompanyEngagementProposalEntry({
  receipt,
}: Readonly<{ receipt: CompanyApplicationReceipt }>) {
  const eligible = ["shortlisted", "invited_to_trial", "accepted"].includes(
    receipt.state
  );
  if (!eligible || receipt.retentionNotice) return null;
  return (
    <p className="profile-proof-boundary">
      <strong>Bounded engagement:</strong> a company hiring member may prepare a
      private paid-trial or milestone-contract proposal from this eligible
      application. It creates no work authorization or payment movement.
      <Link
        className="button button-secondary"
        href={`/company/applications/${receipt.id}/proposal` as Route}
      >
        Prepare engagement proposal
      </Link>
    </p>
  );
}

export function EngagementProposalEditor({
  receipt,
  marketOptions,
  completedTrials,
}: Readonly<{
  receipt: CompanyApplicationReceipt;
  marketOptions: EngagementMarketOption[];
  completedTrials: EngagementListItem[];
}>) {
  const router = useRouter();
  const [state, action] = useActionState(
    createEngagementProposalAction,
    initialEngagementActionState
  );
  useEffect(() => {
    if (state.status === "success" && state.engagementId)
      router.replace(engagementPath(state.engagementId) as Route);
  }, [router, state.engagementId, state.status]);
  const linkedTrials = completedTrials.filter(
    item =>
      item.engagementType === "paid_trial" &&
      item.state === "completed" &&
      item.applicationId === receipt.id
  );
  return (
    <AuthShell
      eyebrow="Company-origin proposal"
      title="Write the exact, paid work record before any work begins"
      description="This is a private proposal for one eligible application. It is not legal advice, an employment classification, a hiring decision, a payment screen, or permission to begin production work."
    >
      <nav className="profile-nav" aria-label="Proposal navigation">
        <Link href={`/company/applications/${receipt.id}`}>
          Application receipt
        </Link>
        <Link href={"/engagements" as Route}>Engagement records</Link>
      </nav>
      {!marketOptions.length ? (
        <section className="profile-empty-state">
          <p className="profile-kicker">Market/provider limitation</p>
          <h2>Paid engagement activation is not available yet</h2>
          <p>
            Proofly has no currently approved market and verified provider
            capability for this workflow. The system will not create a simulated
            funded state, payment data, or unpaid production-work request.
          </p>
          <Link
            className="button button-secondary"
            href={`/company/applications/${receipt.id}`}
          >
            Return to the private receipt
          </Link>
        </section>
      ) : (
        <form
          action={action}
          className="profile-editor-form application-editor-form"
        >
          <input type="hidden" name="applicationId" value={receipt.id} />
          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">01 · Engagement frame</p>
              <h2>State the bounded paid engagement</h2>
              <p>
                Use a paid trial for one paid, time-bounded milestone; a
                milestone contract for defined staged work; or an ongoing
                contract only after a completed paid trial from this
                application.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Engagement type</span>
                <select
                  name="engagementType"
                  required
                  defaultValue="paid_trial"
                >
                  <option value="paid_trial">Paid trial</option>
                  <option value="milestone_contract">Milestone contract</option>
                  <option value="ongoing_contract">Ongoing contract</option>
                </select>
              </label>
              <label>
                <span>Approved market and currency</span>
                <select
                  name="marketSelection"
                  required
                  onChange={event => {
                    const [marketCode, currency] =
                      event.currentTarget.value.split("|");
                    const market = event.currentTarget.form?.elements.namedItem(
                      "marketCode"
                    ) as HTMLInputElement | null;
                    const currencyInput =
                      event.currentTarget.form?.elements.namedItem(
                        "currency"
                      ) as HTMLInputElement | null;
                    if (market) market.value = marketCode ?? "";
                    if (currencyInput) currencyInput.value = currency ?? "";
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select the current policy
                  </option>
                  {marketOptions.map(option => (
                    <option
                      key={`${option.marketCode}-${option.currency}`}
                      value={`${option.marketCode}|${option.currency}`}
                    >
                      {option.marketCode} · {option.currency} · {option.state}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="marketCode" />
              <input type="hidden" name="currency" />
              <label>
                <span>
                  Completed paid trial for ongoing work{" "}
                  <small>Required only for an ongoing contract.</small>
                </span>
                <select name="parentEngagementId" defaultValue="">
                  <option value="">No linked paid trial</option>
                  {linkedTrials.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.projectTitle || "Private project"} · completed paid
                      trial
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Timezone</span>
                <input
                  name="timezone"
                  required
                  maxLength={80}
                  autoComplete="off"
                />
              </label>
            </div>
            <label>
              <span>
                Plain-language summary <small>20–600 characters.</small>
              </span>
              <textarea name="summary" required maxLength={600} />
            </label>
            <label>
              <span>
                Scope <small>What work is included; 30–1,800 characters.</small>
              </span>
              <textarea name="scope" required maxLength={1800} />
            </label>
            <label>
              <span>Deliverables</span>
              <textarea name="deliverables" required maxLength={1800} />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>Exclusions</span>
                <textarea name="exclusions" required maxLength={900} />
              </label>
              <label>
                <span>Dependencies</span>
                <textarea name="dependencies" maxLength={900} />
              </label>
              <label>
                <span>Assumptions</span>
                <textarea name="assumptions" maxLength={900} />
              </label>
              <label>
                <span>Communication cadence</span>
                <input
                  name="communicationCadence"
                  required
                  maxLength={240}
                  autoComplete="off"
                />
              </label>
            </div>
          </section>
          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">02 · Schedule and paid milestone</p>
              <h2>Describe one compensated, reviewable milestone</h2>
              <p>
                Amounts are recorded in the smallest currency unit. The amount
                must exactly equal the milestone amount. Provider funding and
                payment execution remain unavailable in this phase.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Start date</span>
                <input type="date" name="startDate" required />
              </label>
              <label>
                <span>Deadline</span>
                <input type="date" name="deadline" required />
              </label>
              <label>
                <span>Expected effort hours</span>
                <input
                  type="number"
                  name="expectedEffortHours"
                  required
                  min="1"
                  max="9999"
                />
              </label>
              <label>
                <span>Compensation amount (minor unit)</span>
                <input
                  type="number"
                  name="compensationAmountMinor"
                  required
                  min="1"
                />
              </label>
              <label>
                <span>Platform fee (minor unit)</span>
                <input
                  type="number"
                  name="platformFeeMinor"
                  required
                  min="0"
                  defaultValue="0"
                />
              </label>
              <label>
                <span>Payment trigger</span>
                <select name="paymentTrigger" defaultValue="milestone_accepted">
                  <option value="milestone_accepted">Milestone accepted</option>
                  <option value="engagement_completed">
                    Engagement completed
                  </option>
                </select>
              </label>
              <label>
                <span>Payment cadence</span>
                <select name="paymentCadence" defaultValue="per_milestone">
                  <option value="per_milestone">Per milestone</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label>
                <span>Revision allowance</span>
                <select name="revisionAllowance" defaultValue="0">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Taxes and fees note</span>
              <textarea name="taxesAndFeesNote" required maxLength={600} />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>Milestone title</span>
                <input
                  name="milestoneTitle"
                  required
                  maxLength={160}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Milestone deliverable type</span>
                <input
                  name="milestoneDeliverableType"
                  required
                  maxLength={120}
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Milestone due date</span>
                <input type="date" name="milestoneDueDate" required />
              </label>
              <label>
                <span>Milestone amount (minor unit)</span>
                <input
                  type="number"
                  name="milestoneAmountMinor"
                  required
                  min="1"
                />
              </label>
              <label>
                <span>Milestone revision allowance</span>
                <select name="milestoneRevisionAllowance" defaultValue="0">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Milestone description</span>
              <textarea name="milestoneDescription" required maxLength={1400} />
            </label>
            <label>
              <span>Definition of done</span>
              <textarea
                name="milestoneDefinitionOfDone"
                required
                maxLength={1600}
              />
            </label>
            <label>
              <span>Review timeout policy</span>
              <textarea
                name="milestoneTimeoutPolicy"
                required
                maxLength={360}
              />
            </label>
            <label>
              <span>Evidence policy</span>
              <textarea
                name="milestoneEvidencePolicy"
                required
                maxLength={600}
              />
            </label>
          </section>
          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">
                03 · Acceptance, privacy and exceptions
              </p>
              <h2>Make limits explicit before proposal</h2>
              <p>
                Accepted terms become immutable. A material change needs a newly
                recorded version and re-acceptance; it cannot rewrite prior
                records.
              </p>
            </div>
            <label>
              <span>Acceptance criteria</span>
              <textarea name="acceptanceCriteria" required maxLength={1800} />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>
                  Approved non-production tools{" "}
                  <small>
                    Optional; never include a URL, password, token, or
                    credential.
                  </small>
                </span>
                <textarea name="approvedTools" maxLength={600} />
              </label>
              <label>
                <span>Portfolio visibility</span>
                <select
                  name="portfolioVisibility"
                  defaultValue="private_until_explicit_consent"
                >
                  <option value="private_until_explicit_consent">
                    Private until explicit consent
                  </option>
                  <option value="not_permitted">Not permitted</option>
                </select>
              </label>
            </div>
            <label>
              <span>Confidentiality terms</span>
              <textarea name="confidentialityTerms" required maxLength={1200} />
            </label>
            <label>
              <span>Ownership terms</span>
              <textarea name="ownershipTerms" required maxLength={1200} />
            </label>
            <label>
              <span>License terms</span>
              <textarea name="licenseTerms" required maxLength={1200} />
            </label>
            <label>
              <span>Cancellation terms</span>
              <textarea name="cancellationTerms" required maxLength={1200} />
            </label>
            <label>
              <span>Termination terms</span>
              <textarea name="terminationTerms" required maxLength={1200} />
            </label>
            <label>
              <span>Dispute and support route</span>
              <textarea name="disputeTerms" required maxLength={1200} />
              <input
                name="supportRoute"
                required
                maxLength={240}
                autoComplete="off"
              />
            </label>
            <label>
              <span>Visible market/provider limitation</span>
              <textarea
                name="marketLimitationNotice"
                required
                maxLength={900}
              />
            </label>
          </section>
          <div className="profile-save-bar">
            <div>
              <strong>Private proposal only</strong>
              <p>
                Submitting records version 1 for the Talent to review. It cannot
                fund work, move money, grant production access, or make a legal
                determination.
              </p>
            </div>
            <button className="button button-primary" type="submit">
              Record private proposal
            </button>
          </div>
          <Status state={state} />
          <RefreshOnSuccess state={state} />
        </form>
      )}
    </AuthShell>
  );
}

function TermsRecord({
  engagement,
}: Readonly<{ engagement: EngagementDetail }>) {
  const snapshot = engagement.terms?.snapshot ?? {};
  const access =
    snapshot.access_terms && typeof snapshot.access_terms === "object"
      ? (snapshot.access_terms as Record<string, unknown>)
      : {};
  return (
    <section className="profile-section application-detail-section">
      <p className="profile-kicker">
        {engagement.terms
          ? `Terms version ${engagement.terms.version}`
          : "No terms draft"}
      </p>
      <h2>Exact private terms</h2>
      {engagement.terms ? (
        <>
          <dl className="company-public-detail-list">
            <div>
              <dt>Scope</dt>
              <dd>{text(snapshot.scope)}</dd>
            </div>
            <div>
              <dt>Deliverables</dt>
              <dd>{text(snapshot.deliverables)}</dd>
            </div>
            <div>
              <dt>Exclusions</dt>
              <dd>{text(snapshot.exclusions)}</dd>
            </div>
            <div>
              <dt>Dependencies and assumptions</dt>
              <dd>
                {text(snapshot.dependencies, "No dependency added")} ·{" "}
                {text(snapshot.assumptions, "No assumption added")}
              </dd>
            </div>
            <div>
              <dt>Schedule</dt>
              <dd>
                {text(snapshot.start_date)} to {text(snapshot.deadline)} ·{" "}
                {text(snapshot.timezone)} ·{" "}
                {text(snapshot.communication_cadence)}
              </dd>
            </div>
            <div>
              <dt>Compensation record</dt>
              <dd>
                {text(snapshot.compensation_amount_minor)} {engagement.currency}{" "}
                minor units · fee {text(snapshot.platform_fee_minor, "0")} ·
                trigger {text(snapshot.payment_trigger)} · cadence{" "}
                {text(snapshot.payment_cadence)}
              </dd>
            </div>
            <div>
              <dt>Acceptance and revisions</dt>
              <dd>
                {text(snapshot.acceptance_criteria)} ·{" "}
                {text(snapshot.revision_allowance, "0")} listed revisions
              </dd>
            </div>
            <div>
              <dt>Access and confidentiality</dt>
              <dd>
                Production: {text(access.production_access)} · personal
                credentials: {text(access.personal_credentials)} · approved
                tools: {text(access.approved_tools, "None listed")}
              </dd>
            </div>
            <div>
              <dt>Ownership, license and portfolio</dt>
              <dd>
                {text(snapshot.ownership_terms)} ·{" "}
                {text(snapshot.license_terms)} ·{" "}
                {text(snapshot.portfolio_visibility)}
              </dd>
            </div>
            <div>
              <dt>Cancellation, termination and disputes</dt>
              <dd>
                {text(snapshot.cancellation_terms)} ·{" "}
                {text(snapshot.termination_terms)} ·{" "}
                {text(snapshot.dispute_terms)}
              </dd>
            </div>
            <div>
              <dt>Market limitation</dt>
              <dd>{text(snapshot.market_limitation_notice)}</dd>
            </div>
          </dl>
          <p className="profile-proof-boundary">
            <strong>Immutable after acceptance:</strong> this version is a
            private platform record, not legal advice or an
            employment-classification determination. Material scope or
            compensation changes require an explicit new version and both
            parties’ acceptance.
          </p>
        </>
      ) : (
        <p className="profile-empty-copy">
          A company has not recorded a terms draft for this private engagement.
        </p>
      )}
    </section>
  );
}

export function EngagementDetailView({
  engagement,
}: Readonly<{ engagement: EngagementDetail }>) {
  const [negotiationState, negotiationAction] = useActionState(
    recordEngagementNegotiationAction,
    initialEngagementActionState
  );
  const [acceptanceState, acceptanceAction] = useActionState(
    acceptEngagementTermsAction,
    initialEngagementActionState
  );
  const [submissionState, submissionAction] = useActionState(
    submitEngagementMilestoneAction,
    initialEngagementActionState
  );
  const [decisionState, decisionAction] = useActionState(
    decideEngagementMilestoneAction,
    initialEngagementActionState
  );
  const [accessState, accessAction] = useActionState(
    requestEngagementAccessAction,
    initialEngagementActionState
  );
  const [disputeState, disputeAction] = useActionState(
    openEngagementDisputeAction,
    initialEngagementActionState
  );
  const [cancelState, cancelAction] = useActionState(
    cancelEngagementAction,
    initialEngagementActionState
  );
  const [terminateState, terminateAction] = useActionState(
    terminateEngagementAction,
    initialEngagementActionState
  );
  const isTalent = engagement.participantRole === "talent";
  const canNegotiate = ["proposed", "negotiating"].includes(engagement.state);
  return (
    <AuthShell
      eyebrow="Private engagement record"
      title={
        engagement.projectTitle ||
        engagementTypeLabel(engagement.engagementType)
      }
      description="A participant-only record of terms, work, access, and exceptions. It does not create public proof, reputation, matching signals, generic messaging, legal advice, an employment decision, or direct payment execution."
    >
      <nav className="profile-nav" aria-label="Engagement navigation">
        <Link href={"/engagements" as Route}>All engagements</Link>
        {engagement.workspaceId ? (
          <Link href={`/workspaces/${engagement.workspaceId}` as Route}>
            Linked workspace
          </Link>
        ) : null}
        <Link href={`/applications/${engagement.applicationId}` as Route}>
          Linked application
        </Link>
      </nav>
      <div className="application-detail-grid">
        <main className="application-detail-main">
          <section className="profile-section application-status-section">
            <div className="profile-section-heading">
              <p className="profile-kicker">
                {engagementTypeLabel(engagement.engagementType)}
              </p>
              <h2>{engagementStateLabel(engagement.state)}</h2>
              <p>
                {engagement.organizationName
                  ? `${engagement.organizationName} · `
                  : ""}
                Funding record: {engagement.fundingState.replaceAll("_", " ")}.
                Payment execution is unavailable until a verified provider
                integration is introduced in a later phase.
              </p>
            </div>
            <dl className="company-public-detail-list">
              <div>
                <dt>Proposal expiry</dt>
                <dd>{dateText(engagement.proposalExpiresAt)}</dd>
              </div>
              <div>
                <dt>Private role</dt>
                <dd>{engagement.participantRole}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>
                  {engagement.workspaceId
                    ? "Linked private workspace"
                    : "Not linked"}
                </dd>
              </div>
              <div>
                <dt>Safety baseline</dt>
                <dd>
                  Production access {engagement.safety.productionAccess} ·
                  personal credentials {engagement.safety.personalCredentials}
                </dd>
              </div>
            </dl>
          </section>
          <TermsRecord engagement={engagement} />
          {canNegotiate ? (
            <section className="profile-section">
              <p className="profile-kicker">Negotiation ledger</p>
              <h2>Ask, respond, request change, or decline</h2>
              <p>
                Negotiation stays within this private record. It does not open
                generic chat and cannot modify an accepted version.
              </p>
              <form action={negotiationAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <label>
                  <span>Entry type</span>
                  <select name="entryType" defaultValue="question">
                    <option value="question">Question</option>
                    <option value="change_requested">Change requested</option>
                    <option value="response">Response</option>
                    <option value="declined">Decline proposal</option>
                  </select>
                </label>
                <label>
                  <span>Private record</span>
                  <textarea name="body" required maxLength={1600} />
                </label>
                <button className="button button-secondary" type="submit">
                  Record entry
                </button>
                <Status state={negotiationState} />
                <RefreshOnSuccess state={negotiationState} />
              </form>
            </section>
          ) : null}
          {isTalent && engagement.state === "proposed" && engagement.terms ? (
            <section className="profile-section">
              <p className="profile-kicker">Exact version acceptance</p>
              <h2>Accept only this current proposal version</h2>
              <form action={acceptanceAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <input
                  type="hidden"
                  name="termsVersionId"
                  value={engagement.terms.id}
                />
                <label className="profile-checkbox">
                  <input type="checkbox" required />
                  <span>
                    I reviewed the exact private terms in version{" "}
                    {engagement.terms.version}. I understand accepted terms are
                    immutable and payment/work remain gated by verified provider
                    funding.
                  </span>
                </label>
                <button className="button button-primary" type="submit">
                  Accept exact version
                </button>
                <Status state={acceptanceState} />
                <RefreshOnSuccess state={acceptanceState} />
              </form>
            </section>
          ) : null}
          <section className="profile-section">
            <p className="profile-kicker">Milestone ledger</p>
            <h2>Bounded work submissions and human decisions</h2>
            {engagement.milestones.length ? (
              <ul className="public-evidence-list application-evidence-receipt">
                {engagement.milestones.map(milestone => (
                  <li key={milestone.id}>
                    <h3>
                      {milestone.index + 1}. {milestone.title}
                    </h3>
                    <p>{milestone.description}</p>
                    <span>
                      {milestone.deliverableType} · due {milestone.dueDate} ·{" "}
                      {money(milestone.amountMinor, milestone.currency)} · state{" "}
                      {milestone.state.replaceAll("_", " ")} ·{" "}
                      {milestone.submissionCount} submission record(s)
                    </span>
                    <p>{milestone.definitionOfDone}</p>
                    {isTalent &&
                    ["in_progress", "changes_requested"].includes(
                      milestone.state
                    ) ? (
                      <form
                        action={submissionAction}
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
                        <label>
                          <span>
                            Linked private workspace submission version ID
                          </span>
                          <input
                            name="workspaceSubmissionVersionId"
                            required
                            autoComplete="off"
                          />
                        </label>
                        <label>
                          <span>Delivery summary</span>
                          <textarea name="summary" required maxLength={1000} />
                        </label>
                        <label>
                          <span>
                            Known limitations <small>Optional.</small>
                          </span>
                          <textarea name="knownLimitations" maxLength={1400} />
                        </label>
                        <button
                          className="button button-secondary"
                          type="submit"
                        >
                          Record milestone submission
                        </button>
                        <Status state={submissionState} />
                        <RefreshOnSuccess state={submissionState} />
                      </form>
                    ) : null}
                    {!isTalent && milestone.state === "submitted" ? (
                      <form
                        action={decisionAction}
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
                        <label>
                          <span>Accountable company decision</span>
                          <select
                            name="decision"
                            defaultValue="changes_requested"
                          >
                            <option value="changes_requested">
                              Request changes
                            </option>
                            <option value="accepted_for_payment">
                              Accept for future payment step
                            </option>
                            <option value="dispute_raised">
                              Raise dispute
                            </option>
                          </select>
                        </label>
                        <label>
                          <span>Specific rationale</span>
                          <textarea
                            name="rationale"
                            required
                            maxLength={1600}
                          />
                        </label>
                        <button
                          className="button button-secondary"
                          type="submit"
                        >
                          Record decision
                        </button>
                        <Status state={decisionState} />
                        <RefreshOnSuccess state={decisionState} />
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-empty-copy">
                Milestones materialize only after verified funding and a linked
                private workspace. No work is requested before those gates.
              </p>
            )}
          </section>
          {isTalent ? (
            <section className="profile-section">
              <p className="profile-kicker">Least-privilege access</p>
              <h2>Request non-production metadata access only</h2>
              <p>
                The access ledger does not deliver a URL, token, secret,
                password, credential, or production access. A company owner must
                approve an unexpired request.
              </p>
              <form action={accessAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <div className="profile-form-grid">
                  <label>
                    <span>Access kind</span>
                    <select name="accessKind" defaultValue="documentation">
                      <option value="documentation">Documentation</option>
                      <option value="repository">Repository metadata</option>
                      <option value="staging_environment">
                        Staging environment metadata
                      </option>
                      <option value="sandbox_data">Sandbox data</option>
                      <option value="other_non_production">
                        Other non-production
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>Expiry in UTC</span>
                    <input type="datetime-local" name="expiresAt" required />
                  </label>
                </div>
                <label>
                  <span>Resource label</span>
                  <input
                    name="resourceLabel"
                    required
                    maxLength={240}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Purpose</span>
                  <textarea name="purpose" required maxLength={600} />
                </label>
                <button className="button button-secondary" type="submit">
                  Request company approval
                </button>
                <Status state={accessState} />
                <RefreshOnSuccess state={accessState} />
              </form>
            </section>
          ) : null}
          <section className="profile-section">
            <p className="profile-kicker">Access record</p>
            <h2>Expiry and revocation fail closed</h2>
            {engagement.accessGrants.length ? (
              <ul className="public-evidence-list application-evidence-receipt">
                {engagement.accessGrants.map(grant => (
                  <li key={grant.id}>
                    <h3>{grant.resourceLabel}</h3>
                    <p>{grant.purpose}</p>
                    <span>
                      {grant.accessKind.replaceAll("_", " ")} ·{" "}
                      {grant.state.replaceAll("_", " ")} · expires{" "}
                      {dateText(grant.expiresAt)}
                    </span>
                    <AccessControls
                      engagement={engagement}
                      accessGrantId={grant.id}
                      canGrant={!isTalent && grant.state === "requested"}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-empty-copy">
                No access requests or grants are recorded.
              </p>
            )}
          </section>
          <section className="profile-section">
            <p className="profile-kicker">Safety and exception record</p>
            <h2>
              Cancel, terminate, or open a dispute without rewriting evidence
            </h2>
            <p>
              These actions do not decide legal rights or release funds. A
              dispute pauses new work and revokes access records for accountable
              human review.
            </p>
            {[
              "draft",
              "proposed",
              "negotiating",
              "accepted",
              "funding_required",
              "funded",
            ].includes(engagement.state) ? (
              <ReasonForm
                action={cancelAction}
                engagementId={engagement.id}
                button="Cancel before start"
                state={cancelState}
              />
            ) : null}
            {[
              "in_progress",
              "submitted",
              "changes_requested",
              "accepted_for_payment",
              "disputed",
            ].includes(engagement.state) ? (
              <ReasonForm
                action={terminateAction}
                engagementId={engagement.id}
                button="Terminate engagement"
                state={terminateState}
              />
            ) : null}
            {[
              "funding_required",
              "funded",
              "in_progress",
              "submitted",
              "changes_requested",
              "accepted_for_payment",
              "completed",
            ].includes(engagement.state) ? (
              <form action={disputeAction} className="profile-editor-form">
                <input
                  type="hidden"
                  name="engagementId"
                  value={engagement.id}
                />
                <label>
                  <span>
                    Related milestone <small>Optional.</small>
                  </span>
                  <select name="milestoneId" defaultValue="">
                    <option value="">Engagement-level dispute</option>
                    {engagement.milestones.map(milestone => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Category</span>
                  <select name="category" defaultValue="other">
                    <option value="scope_creep">Scope creep</option>
                    <option value="harassment">Harassment</option>
                    <option value="unsafe_instruction">
                      Unsafe instruction
                    </option>
                    <option value="suspected_unpaid_work">
                      Suspected unpaid work
                    </option>
                    <option value="payment_dependency">
                      Payment dependency
                    </option>
                    <option value="access_safety">Access safety</option>
                    <option value="quality_or_acceptance">
                      Quality or acceptance
                    </option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  <span>Private reason</span>
                  <textarea name="reason" required maxLength={1800} />
                </label>
                <label>
                  <span>Requested remedy</span>
                  <textarea name="requestedRemedy" required maxLength={1200} />
                </label>
                <button className="button button-danger" type="submit">
                  Open dispute and pause new work
                </button>
                <Status state={disputeState} />
                <RefreshOnSuccess state={disputeState} />
              </form>
            ) : null}
          </section>
        </main>
        <aside className="profile-aside">
          <section className="profile-preview application-status-ledger">
            <div className="profile-preview-heading">
              <div>
                <p className="profile-kicker">Version history</p>
                <h2>Terms are not silently rewritten</h2>
              </div>
            </div>
            <ol>
              {engagement.termsHistory.map(version => (
                <li key={version.id}>
                  <strong>
                    Version {version.version} · {version.state}
                  </strong>
                  <span>{dateText(version.acceptedAt)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="profile-preview application-status-ledger">
            <div className="profile-preview-heading">
              <div>
                <p className="profile-kicker">Private activity</p>
                <h2>Immutable sequence</h2>
              </div>
            </div>
            <ol>
              {engagement.events.map(event => (
                <li key={`${event.eventType}-${event.occurredAt}`}>
                  <strong>
                    {event.eventType
                      .replaceAll(".", " · ")
                      .replaceAll("_", " ")}
                  </strong>
                  <span>{dateText(event.occurredAt)}</span>
                </li>
              ))}
            </ol>
          </section>
          {engagement.disputes.length ? (
            <section className="profile-checklist application-terms-receipt">
              <p className="profile-kicker">Dispute records</p>
              <h2>Evidence remains retained</h2>
              {engagement.disputes.map(dispute => (
                <p key={dispute.id}>
                  {dispute.category.replaceAll("_", " ")} · {dispute.state} ·{" "}
                  {dateText(dispute.openedAt)}
                </p>
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </AuthShell>
  );
}

function AccessControls({
  engagement,
  accessGrantId,
  canGrant,
}: Readonly<{
  engagement: EngagementDetail;
  accessGrantId: string;
  canGrant: boolean;
}>) {
  const [grantState, grantAction] = useActionState(
    grantEngagementAccessAction,
    initialEngagementActionState
  );
  const [revokeState, revokeAction] = useActionState(
    revokeEngagementAccessAction,
    initialEngagementActionState
  );
  return (
    <div className="evidence-owner-actions">
      {canGrant ? (
        <form action={grantAction}>
          <input type="hidden" name="engagementId" value={engagement.id} />
          <input type="hidden" name="accessGrantId" value={accessGrantId} />
          <button className="button button-secondary" type="submit">
            Record approval
          </button>
          <Status state={grantState} />
          <RefreshOnSuccess state={grantState} />
        </form>
      ) : null}
      <form action={revokeAction}>
        <input type="hidden" name="engagementId" value={engagement.id} />
        <input type="hidden" name="accessGrantId" value={accessGrantId} />
        <button className="button button-danger" type="submit">
          Revoke
        </button>
        <Status state={revokeState} />
        <RefreshOnSuccess state={revokeState} />
      </form>
    </div>
  );
}

function ReasonForm({
  action,
  engagementId,
  button,
  state,
}: Readonly<{
  action: (payload: FormData) => void;
  engagementId: string;
  button: string;
  state: EngagementActionState;
}>) {
  return (
    <form action={action} className="profile-editor-form">
      <input type="hidden" name="engagementId" value={engagementId} />
      <label>
        <span>Reason</span>
        <textarea name="reason" required maxLength={900} />
      </label>
      <button className="button button-danger" type="submit">
        {button}
      </button>
      <Status state={state} />
      <RefreshOnSuccess state={state} />
    </form>
  );
}

export function EngagementDisputeQueue({
  disputes,
}: Readonly<{ disputes: EngagementDisputeQueueItem[] }>) {
  return (
    <AuthShell
      eyebrow="Administrator dispute review"
      title="Accountable human review of private engagement disputes"
      description="Only an authorized administrator can record a resolution. This record does not give legal advice, decide employment status, alter accepted terms, execute payment, or reopen work automatically."
    >
      <nav
        className="profile-nav"
        aria-label="Administrator engagement navigation"
      >
        <Link href={"/admin/verifications" as Route}>Verification queue</Link>
        <Link href={"/admin/engagements/disputes" as Route} aria-current="page">
          Engagement disputes
        </Link>
      </nav>
      {disputes.length ? (
        <ul className="evidence-owner-list application-owner-list">
          {disputes.map(dispute => (
            <li key={dispute.id}>
              <div>
                <p className="profile-kicker">
                  {dispute.category.replaceAll("_", " ")} · {dispute.state}
                </p>
                <h3>Dispute opened {dateText(dispute.openedAt)}</h3>
                <p>{dispute.reason}</p>
                <small>Requested remedy: {dispute.requestedRemedy}</small>
                <Link href={engagementPath(dispute.engagementId) as Route}>
                  Open participant engagement record
                </Link>
              </div>
              <DisputeResolutionForm disputeId={dispute.id} />
            </li>
          ))}
        </ul>
      ) : (
        <section className="profile-empty-state">
          <p className="profile-kicker">No open private disputes</p>
          <h2>Nothing requires administrator resolution</h2>
          <p>
            There is no automatic dispute decision or payment-provider action in
            this phase.
          </p>
        </section>
      )}
    </AuthShell>
  );
}

function DisputeResolutionForm({ disputeId }: Readonly<{ disputeId: string }>) {
  const [state, action] = useActionState(
    resolveEngagementDisputeAction,
    initialEngagementActionState
  );
  return (
    <form action={action} className="profile-editor-form">
      <input type="hidden" name="disputeId" value={disputeId} />
      <label>
        <span>Accountable outcome</span>
        <select name="outcome" defaultValue="returned_to_parties">
          <option value="returned_to_parties">Returned to parties</option>
          <option value="terminated_with_hold">Terminated with hold</option>
          <option value="cancelled_before_start">Cancelled before start</option>
          <option value="escalated_to_payment_provider">
            Escalated to payment provider
          </option>
          <option value="no_platform_action">No platform action</option>
        </select>
      </label>
      <label>
        <span>Human resolution summary</span>
        <textarea name="resolutionSummary" required maxLength={1800} />
      </label>
      <button className="button button-primary" type="submit">
        Record resolution
      </button>
      <Status state={state} />
      <RefreshOnSuccess state={state} />
    </form>
  );
}
