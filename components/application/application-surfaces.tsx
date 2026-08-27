"use client";

/** Phase 24/33 Evidence Ledger Editorial style: the application remains a concise evidence-led private record; its limited engagement entry never turns it into a marketplace, generic chat, public contract, or automated hiring funnel. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useActionState, useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { ContextConversationButton } from "@/components/communication/messaging-surfaces";
import {
  saveProjectApplicationAction,
  submitProjectApplicationAction,
  withdrawProjectApplicationAction,
} from "@/lib/application/actions";
import { CompanyEngagementProposalEntry } from "@/components/engagement/engagement-surfaces";
import {
  applicationPath,
  applicationStateLabel,
  canWithdrawApplication,
  initialApplicationActionState,
  type ApplicationActionState,
  type ApplicationEditorContext,
  type ApplicationListItem,
  type CompanyApplicationReceipt,
  type ProjectApplication,
} from "@/lib/application/types";

const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(new Date(value))
    : "Not recorded";

function Status({ state }: Readonly<{ state: ApplicationActionState }>) {
  if (state.status === "idle") return null;
  return (
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

function FieldError({
  state,
  name,
}: Readonly<{ state: ApplicationActionState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="profile-field-error">{message}</p> : null;
}

function TermsSummary({
  project,
}: Readonly<{ project: ApplicationEditorContext["project"] }>) {
  return (
    <dl className="company-public-detail-list application-terms-list">
      <div>
        <dt>Deadline</dt>
        <dd>{project.applicationDeadline}</dd>
      </div>
      <div>
        <dt>Expected response</dt>
        <dd>{project.expectedResponseTime}</dd>
      </div>
      <div>
        <dt>Compensation context</dt>
        <dd>{project.compensationStatus.replaceAll("_", " ")}</dd>
      </div>
      <div>
        <dt>Timebox</dt>
        <dd>{project.timeboxHours} hours</dd>
      </div>
      <div>
        <dt>Ownership and IP</dt>
        <dd>{project.ownershipTerms}</dd>
      </div>
      <div>
        <dt>Data and access</dt>
        <dd>{project.dataAccessRestrictions}</dd>
      </div>
    </dl>
  );
}

function ApplicationPreview({
  context,
  selectedEvidenceIds,
  values,
}: Readonly<{
  context: ApplicationEditorContext;
  selectedEvidenceIds: string[];
  values: {
    availability: string;
    timezoneOverlap: string;
    motivation: string;
    relevantExperience: string;
    projectResponse: string;
    approach: string;
  };
}>) {
  const selectedEvidence = context.availableEvidence.filter(item =>
    selectedEvidenceIds.includes(item.id)
  );
  return (
    <section
      className="profile-preview application-preview"
      aria-labelledby="application-preview-title"
    >
      <div className="profile-preview-heading">
        <div>
          <p className="profile-kicker">Private preview</p>
          <h2 id="application-preview-title">What the company will receive</h2>
        </div>
        <span className="profile-state-badge">Private</span>
      </div>
      <div className="profile-preview-surface application-preview-surface">
        <p className="profile-preview-name">{context.project.title}</p>
        <p className="profile-preview-headline">
          Your existing profile context is referenced as a private snapshot.
          This form does not recreate your resume.
        </p>
        <dl className="profile-preview-meta">
          <div>
            <dt>Availability</dt>
            <dd>{values.availability || "Not added"}</dd>
          </div>
          <div>
            <dt>Timezone overlap</dt>
            <dd>{values.timezoneOverlap || "Not added"}</dd>
          </div>
          <div>
            <dt>Evidence selected</dt>
            <dd>{selectedEvidence.length}</dd>
          </div>
          <div>
            <dt>Project terms</dt>
            <dd>Reviewed before submit</dd>
          </div>
        </dl>
        <div className="application-preview-evidence">
          <p>Selected evidence</p>
          {selectedEvidence.length ? (
            <ul>
              {selectedEvidence.map(item => (
                <li key={item.id}>
                  <strong>{item.title || "Untitled evidence"}</strong>
                  <span>{item.shortSummary || "No short summary added."}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              Choose at least one relevant evidence item before submitting.
            </p>
          )}
        </div>
        <p className="profile-proof-boundary">
          <strong>Privacy boundary:</strong> selected evidence is shared only in
          this private company receipt. Selecting it does not publish evidence,
          copy its links, or change its visibility.
        </p>
      </div>
    </section>
  );
}

export function ApplicationEditor({
  context,
}: Readonly<{ context: ApplicationEditorContext }>) {
  const router = useRouter();
  const application = context.existingApplication;
  const [saveState, saveAction] = useActionState(
    saveProjectApplicationAction,
    initialApplicationActionState
  );
  const [submitState, submitAction] = useActionState(
    submitProjectApplicationAction,
    initialApplicationActionState
  );
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(
    application?.evidenceSnapshot.map(item => item.evidenceId) ?? []
  );
  const [values, setValues] = useState({
    availability: application?.availability ?? "",
    timezoneOverlap: application?.timezoneOverlap ?? "",
    motivation: application?.motivation ?? "",
    relevantExperience: application?.relevantExperience ?? "",
    projectResponse: application?.projectResponse ?? "",
    approach: application?.approach ?? "",
  });
  const activeEvidence = useMemo(
    () => context.availableEvidence.filter(item => item.id),
    [context.availableEvidence]
  );

  useEffect(() => {
    if (saveState.status === "success") router.refresh();
  }, [router, saveState.status]);
  useEffect(() => {
    if (submitState.status === "success" && submitState.applicationId) {
      router.replace(applicationPath(submitState.applicationId) as Route);
      router.refresh();
    }
  }, [router, submitState.applicationId, submitState.status]);

  if (!context.activeTalentContext) {
    return (
      <AuthShell
        eyebrow="Project application"
        title="Switch to Talent to apply"
        description="Applications are private Talent records. Choose an active Talent context before starting one."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose a context
        </Link>
      </AuthShell>
    );
  }

  if (application && application.state !== "draft") {
    return (
      <AuthShell
        eyebrow="Project application"
        title="This application already has a private status"
        description="A second active application is not created. Open the existing receipt to see the state and the company’s stated response expectation."
      >
        <Link
          className="button button-primary"
          href={applicationPath(application.id) as Route}
        >
          Open application status
        </Link>
      </AuthShell>
    );
  }

  if (!context.canApply && !application) {
    return (
      <AuthShell
        eyebrow="Project application"
        title="This project is not accepting applications"
        description="The server confirms application eligibility at save and submit time. A project must be public, accepting applications, and within its stated deadline."
      >
        <Link
          className="button button-secondary"
          href={`/projects/${context.project.publicId}`}
        >
          Return to project context
        </Link>
      </AuthShell>
    );
  }

  const setValue = (key: keyof typeof values, value: string) =>
    setValues(current => ({ ...current, [key]: value }));
  const toggleEvidence = (id: string, checked: boolean) =>
    setSelectedEvidenceIds(current => {
      if (!checked) return current.filter(item => item !== id);
      return current.length >= 6 ? current : [...current, id];
    });

  return (
    <AuthShell
      eyebrow="Project application"
      title={
        application
          ? "Review your private application draft"
          : "Apply with relevant evidence, not a long proposal"
      }
      description="Connect your existing profile and selected work evidence to this project. Proofly does not request an application artifact, repeat your resume, promise a response, or make a hiring decision."
    >
      <nav className="profile-nav" aria-label="Talent application navigation">
        <Link href="/projects">Explore projects</Link>
        <Link href={`/projects/${context.project.publicId}`}>
          Project context
        </Link>
        <Link href={"/applications" as Route}>My applications</Link>
      </nav>
      <div className="profile-layout application-layout">
        <form
          action={saveAction}
          className="profile-editor-form application-editor-form"
        >
          <input
            type="hidden"
            name="publicId"
            value={context.project.publicId}
          />
          <input
            type="hidden"
            name="applicationId"
            value={application?.id ?? ""}
          />
          <input
            type="hidden"
            name="evidenceIds"
            value={JSON.stringify(selectedEvidenceIds)}
          />
          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">01 · Project fit</p>
              <h2>Respond to the stated goal and acceptance criteria</h2>
              <p>
                This is the project-specific response. It asks for no
                demographic data, resume repetition, file upload, or unpaid
                production work.
              </p>
            </div>
            <p className="application-project-prompt">
              <strong>{context.project.oneSentenceGoal}</strong>
              <span>Required output: {context.project.requiredOutput}</span>
              <span>
                Acceptance criteria: {context.project.acceptanceCriteria}
              </span>
            </p>
            <label>
              <span>
                Project response{" "}
                <small>
                  10–800 characters; explain fit with the stated goal,
                  deliverables, and criteria.
                </small>
              </span>
              <textarea
                name="projectResponse"
                value={values.projectResponse}
                onChange={event =>
                  setValue("projectResponse", event.target.value)
                }
                maxLength={800}
                required
              />
              <FieldError state={saveState} name="projectResponse" />
            </label>
            <label>
              <span>
                Relevant experience context{" "}
                <small>
                  10–900 characters; add only what your profile and selected
                  evidence do not already make clear.
                </small>
              </span>
              <textarea
                name="relevantExperience"
                value={values.relevantExperience}
                onChange={event =>
                  setValue("relevantExperience", event.target.value)
                }
                maxLength={900}
                required
              />
              <FieldError state={saveState} name="relevantExperience" />
            </label>
            <label>
              <span>
                Short motivation{" "}
                <small>10–600 characters; no default long cover letter.</small>
              </span>
              <textarea
                name="motivation"
                value={values.motivation}
                onChange={event => setValue("motivation", event.target.value)}
                maxLength={600}
                required
              />
              <FieldError state={saveState} name="motivation" />
            </label>
            <label>
              <span>
                Optional approach{" "}
                <small>
                  Up to 1,000 characters. Do not submit a production deliverable
                  here.
                </small>
              </span>
              <textarea
                name="approach"
                value={values.approach}
                onChange={event => setValue("approach", event.target.value)}
                maxLength={1000}
              />
              <FieldError state={saveState} name="approach" />
            </label>
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">02 · Relevant evidence</p>
              <h2>Select up to six private receipt references</h2>
              <p>
                Select only evidence that helps explain your fit. Evidence
                remains under your visibility control and its links,
                attribution, permission notes, and publication state are not
                copied here.
              </p>
            </div>
            {activeEvidence.length ? (
              <ul className="application-evidence-select">
                {activeEvidence.map(item => {
                  const checked = selectedEvidenceIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label className="profile-checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && selectedEvidenceIds.length >= 6}
                          onChange={event =>
                            toggleEvidence(item.id, event.target.checked)
                          }
                        />
                        <span>
                          <strong>{item.title || "Untitled evidence"}</strong>
                          <small>
                            {item.shortSummary || "No short summary added."}
                          </small>
                          <small>
                            Private receipt reference · v{item.version} ·{" "}
                            {item.state.replaceAll("_", " ")}
                          </small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="profile-empty-copy">
                Create and save at least one non-archived evidence record before
                submitting an application.
              </p>
            )}
            <FieldError state={saveState} name="evidenceIds" />
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <p className="profile-index">03 · Availability and terms</p>
              <h2>Make the work context clear before you submit</h2>
              <p>
                These are practical coordination details, not a promise of
                selection, payment, or a contract.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>
                  Availability <small>Up to 240 characters.</small>
                </span>
                <input
                  name="availability"
                  value={values.availability}
                  onChange={event =>
                    setValue("availability", event.target.value)
                  }
                  maxLength={240}
                  required
                  autoComplete="off"
                />
                <FieldError state={saveState} name="availability" />
              </label>
              <label>
                <span>
                  Timezone overlap <small>Up to 160 characters.</small>
                </span>
                <input
                  name="timezoneOverlap"
                  value={values.timezoneOverlap}
                  onChange={event =>
                    setValue("timezoneOverlap", event.target.value)
                  }
                  maxLength={160}
                  required
                  autoComplete="off"
                />
                <FieldError state={saveState} name="timezoneOverlap" />
              </label>
            </div>
            <TermsSummary project={context.project} />
            <p className="profile-proof-boundary">
              <strong>Terms snapshot:</strong> when you submit, the visible
              deadline, compensation context, purpose, timebox, ownership,
              access, participant expectations, and stated response time are
              retained with the application.
            </p>
          </section>

          <div className="profile-save-bar">
            <div>
              <strong>Private application draft</strong>
              <p>
                Saving keeps this application visible only to you. It does not
                notify the company.
              </p>
            </div>
            <button className="button button-primary" type="submit">
              Save private draft
            </button>
          </div>
          <Status state={saveState} />
        </form>
        <aside className="profile-aside">
          <ApplicationPreview
            context={context}
            selectedEvidenceIds={selectedEvidenceIds}
            values={values}
          />
          <section
            className="profile-checklist application-checklist"
            aria-labelledby="application-checklist-title"
          >
            <p className="profile-kicker">Before submit</p>
            <h2 id="application-checklist-title">A concise, private handoff</h2>
            <ul>
              <li data-complete={selectedEvidenceIds.length > 0}>
                <span aria-hidden="true">
                  {selectedEvidenceIds.length > 0 ? "✓" : "○"}
                </span>
                Select relevant evidence
              </li>
              <li data-complete={values.projectResponse.trim().length >= 10}>
                <span aria-hidden="true">
                  {values.projectResponse.trim().length >= 10 ? "✓" : "○"}
                </span>
                Answer the project-specific prompt
              </li>
              <li
                data-complete={
                  values.availability.trim().length > 0 &&
                  values.timezoneOverlap.trim().length > 0
                }
              >
                <span aria-hidden="true">
                  {values.availability.trim().length > 0 &&
                  values.timezoneOverlap.trim().length > 0
                    ? "✓"
                    : "○"}
                </span>
                Add availability and overlap
              </li>
              <li data-complete={Boolean(application?.id)}>
                <span aria-hidden="true">{application?.id ? "✓" : "○"}</span>
                Save and review the private draft
              </li>
            </ul>
          </section>
          {application?.id ? (
            <form action={submitAction} className="application-submit-card">
              <input
                type="hidden"
                name="applicationId"
                value={application.id}
              />
              <p className="profile-kicker">Final confirmation</p>
              <h2>Submit the reviewed snapshot</h2>
              <p>
                The server checks the project state and deadline again.
                Submission does not promise a response or opportunity outcome.
              </p>
              <label className="profile-checkbox">
                <input
                  name="confirmProjectTerms"
                  value="confirmed"
                  type="checkbox"
                  required
                />
                <span>
                  I reviewed and agree to the visible project terms for this
                  application.
                </span>
              </label>
              <button className="button button-primary" type="submit">
                Submit application
              </button>
              <Status state={submitState} />
            </form>
          ) : null}
        </aside>
      </div>
    </AuthShell>
  );
}

export function ApplicationsList({
  applications,
}: Readonly<{ applications: ApplicationListItem[] }>) {
  return (
    <AuthShell
      eyebrow="Talent applications"
      title="Private application status"
      description="Only your applications appear here. Company response timing is stated by the company; Proofly does not promise a response or opportunity outcome."
    >
      <nav className="profile-nav" aria-label="Talent application navigation">
        <Link href="/projects">Explore projects</Link>
        <Link href="/profile">Profile</Link>
        <Link href={"/applications" as Route} aria-current="page">
          My applications
        </Link>
      </nav>
      {applications.length ? (
        <ul className="evidence-owner-list application-owner-list">
          {applications.map(application => (
            <li key={application.id}>
              <div>
                <p className="profile-kicker">
                  {applicationStateLabel(application.state)}
                </p>
                <h3>{application.projectTitle}</h3>
                <p>{application.organizationName}</p>
                <small>
                  Expected response:{" "}
                  {application.expectedResponseTime || "Not stated"}
                </small>
                <small>Last updated: {dateText(application.updatedAt)}</small>
              </div>
              <div className="evidence-owner-actions">
                <Link
                  className="button button-secondary"
                  href={applicationPath(application.id) as Route}
                >
                  Open status
                </Link>
                <Link href={`/projects/${application.projectPublicId}`}>
                  Project context
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="profile-empty-state">
          <p className="profile-kicker">No private applications yet</p>
          <h2>Review a project before you apply</h2>
          <p>
            Applications begin only from a public project currently accepting
            applications. You can select evidence without changing what is
            public.
          </p>
          <Link className="button button-primary" href="/projects">
            Explore projects
          </Link>
        </section>
      )}
    </AuthShell>
  );
}

function SnapshotDetail({
  application,
}: Readonly<{ application: ProjectApplication }>) {
  return (
    <>
      <section className="profile-section application-detail-section">
        <p className="profile-kicker">Private receipt</p>
        <h2>Profile and evidence snapshot</h2>
        <dl className="company-public-detail-list">
          <div>
            <dt>Profile context</dt>
            <dd>
              {[
                application.profileSnapshot.displayName,
                application.profileSnapshot.headline,
                application.profileSnapshot.developerFocus,
              ]
                .filter(Boolean)
                .join(" · ") || "Existing private profile snapshot"}
            </dd>
          </div>
          <div>
            <dt>Selected evidence</dt>
            <dd>
              {application.evidenceSnapshot.length} private receipt reference
              {application.evidenceSnapshot.length === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
        <ul className="public-evidence-list application-evidence-receipt">
          {application.evidenceSnapshot.map(item => (
            <li key={item.evidenceId}>
              <h3>{item.title || "Untitled evidence"}</h3>
              <p>{item.shortSummary || "No short summary was included."}</p>
              <span>
                Private receipt reference · v{item.sourceVersion} · links and
                source visibility are not copied
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="profile-section application-detail-section">
        <p className="profile-kicker">Submitted context</p>
        <h2>Concise project response</h2>
        <dl className="company-public-detail-list">
          <div>
            <dt>Availability</dt>
            <dd>{application.availability}</dd>
          </div>
          <div>
            <dt>Timezone overlap</dt>
            <dd>{application.timezoneOverlap}</dd>
          </div>
          <div>
            <dt>Motivation</dt>
            <dd>{application.motivation}</dd>
          </div>
          <div>
            <dt>Relevant experience</dt>
            <dd>{application.relevantExperience}</dd>
          </div>
          <div>
            <dt>Project response</dt>
            <dd>{application.projectResponse}</dd>
          </div>
          {application.approach ? (
            <div>
              <dt>Optional approach</dt>
              <dd>{application.approach}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
  );
}

export function ApplicationWithdrawalControl({
  application,
}: Readonly<{ application: ProjectApplication }>) {
  const router = useRouter();
  const [state, action] = useActionState(
    withdrawProjectApplicationAction,
    initialApplicationActionState
  );
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  if (!canWithdrawApplication(application.state)) return null;
  return (
    <form action={action} className="application-withdraw-form">
      <input type="hidden" name="applicationId" value={application.id} />
      <button className="button button-danger" type="submit">
        Withdraw application
      </button>
      <Status state={state} />
    </form>
  );
}

export function ApplicationDetail({
  application,
}: Readonly<{ application: ProjectApplication }>) {
  const retained =
    application.state === "withdrawn" || application.state === "rejected";
  return (
    <AuthShell
      eyebrow="Private application receipt"
      title={application.project.title}
      description="This receipt shows your application state and the company’s stated response expectation. It does not guarantee a response, selection, contract, payment, or trial."
    >
      <nav className="profile-nav" aria-label="Talent application navigation">
        <Link href={"/applications" as Route}>My applications</Link>
        <Link href={`/projects/${application.project.publicId}`}>
          Project context
        </Link>
      </nav>
      <div className="application-detail-grid">
        <main className="application-detail-main">
          <section className="profile-section application-status-section">
            <div className="profile-section-heading">
              <p className="profile-kicker">Current state</p>
              <h2>{applicationStateLabel(application.state)}</h2>
              <p>
                {retained
                  ? "This application is retained as a private, auditable participant record."
                  : "The company receives the approved application snapshot only after submission."}
              </p>
            </div>
            <dl className="company-public-detail-list">
              <div>
                <dt>Submitted</dt>
                <dd>{dateText(application.submittedAt)}</dd>
              </div>
              <div>
                <dt>Expected response</dt>
                <dd>
                  {application.project.expectedResponseTime ||
                    "The company did not state a response time."}
                </dd>
              </div>
              <div>
                <dt>Project deadline</dt>
                <dd>{application.project.applicationDeadline}</dd>
              </div>
              {application.withdrawnAt ? (
                <div>
                  <dt>Withdrawn</dt>
                  <dd>{dateText(application.withdrawnAt)}</dd>
                </div>
              ) : null}
            </dl>
            <ApplicationWithdrawalControl application={application} />
            {!retained ? (
              <ContextConversationButton
                contextType="application"
                contextEntityId={application.id}
                label="Open application conversation"
              />
            ) : null}
          </section>
          <SnapshotDetail application={application} />
        </main>
        <aside className="profile-aside">
          <section className="profile-preview application-status-ledger">
            <div className="profile-preview-heading">
              <div>
                <p className="profile-kicker">Audit history</p>
                <h2>Private state record</h2>
              </div>
            </div>
            <ol>
              {application.events.map(event => (
                <li key={`${event.eventType}-${event.occurredAt}`}>
                  <strong>
                    {event.eventType
                      .replace("application.", "")
                      .replaceAll("_", " ")}
                  </strong>
                  <span>{dateText(event.occurredAt)}</span>
                </li>
              ))}
            </ol>
          </section>
          {application.termsSnapshot ? (
            <section className="profile-checklist application-terms-receipt">
              <p className="profile-kicker">Submitted terms snapshot</p>
              <h2>Terms confirmed at submission</h2>
              <p>
                {application.termsSnapshot.expectedResponseTime ||
                  "Response time not stated"}
              </p>
              <p>{application.termsSnapshot.ownershipTerms}</p>
              <p>{application.termsSnapshot.dataAccessRestrictions}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </AuthShell>
  );
}

export function CompanyApplicationReceiptView({
  receipt,
}: Readonly<{ receipt: CompanyApplicationReceipt }>) {
  const retained = Boolean(receipt.retentionNotice);
  return (
    <AuthShell
      eyebrow="Authorized company receipt"
      title={receipt.project.title}
      description="This is a private participant record for authorized company members. It is not an applicant list, review workspace, shortlist control, messaging surface, hiring decision, contract, or payment workflow."
    >
      <section className="profile-section application-company-receipt">
        <p className="profile-kicker">Application state</p>
        <h2>{applicationStateLabel(receipt.state)}</h2>
        <p>{receipt.project.organizationName}</p>
        {retained ? (
          <p className="profile-proof-boundary">
            <strong>Retention:</strong> {receipt.retentionNotice}
          </p>
        ) : (
          <>
            <SnapshotDetail application={receipt} />
            <ContextConversationButton
              contextType="application"
              contextEntityId={receipt.id}
              label="Open application conversation"
            />
            <CompanyEngagementProposalEntry receipt={receipt} />
          </>
        )}
      </section>
    </AuthShell>
  );
}
