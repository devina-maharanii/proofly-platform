"use client";

/** Evidence Ledger Editorial — Phase 32 presents deterministic source-led matching as a review aid, never an opaque score or hiring decision. */
import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";

import {
  dismissMatchingRecommendationAction,
  recordMatchingFeedbackAction,
  recordMatchingHumanOverrideAction,
  reportMatchingRecommendationAction,
  saveMatchingPreferencesAction,
  saveMatchingProjectRequirementsAction,
} from "@/lib/matching/actions";
import {
  initialMatchingActionState,
  matchingAvailabilityStates,
  matchingFeedbackTypes,
  matchingHumanActions,
  matchingParticipationStates,
  matchingRequirementAvailabilityStates,
  matchingWorkArrangements,
  type CompanyMatchingContext,
  type MatchingActionState,
  type MatchingAdministrationSummary,
  type MatchingFitSummary,
  type MatchingPreferences,
  type MatchingProjectRequirements,
  type MatchingSource,
  type TalentMatchingContext,
} from "@/lib/matching/types";
import {
  canonicalSkillLabel,
  type CanonicalSkillKey,
} from "@/lib/profile/types";
import { ProjectSaveControl } from "@/components/project/project-discovery";

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function Status({ state }: Readonly<{ state: MatchingActionState }>) {
  if (state.status === "idle") return null;
  return (
    <p
      className={`matching-status matching-status-${state.status}`}
      role="status"
    >
      {state.message}
    </p>
  );
}

function Sources({ sources }: Readonly<{ sources: MatchingSource[] }>) {
  if (!sources.length)
    return (
      <p className="matching-muted">
        No valid public source is available for this recommendation.
      </p>
    );
  return (
    <ul className="matching-sources" aria-label="Recommendation sources">
      {sources.map((source, index) => (
        <li key={`${source.type}-${source.href}-${index}`}>
          <Link href={source.href as Route}>{source.label}</Link>
          {source.detail ? <span>{source.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function FitExplanation({
  summary,
  sources,
}: Readonly<{ summary: MatchingFitSummary; sources: MatchingSource[] }>) {
  return (
    <details className="matching-explanation">
      <summary>Why this appears</summary>
      <div>
        <section>
          <h3>Verified alignment</h3>
          {summary.reasons.length ? (
            <ul>
              {summary.reasons.map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>Nothing is inferred beyond the listed public sources.</p>
          )}
        </section>
        <section>
          <h3>Needs clarification</h3>
          {summary.gaps.length ? (
            <ul>
              {summary.gaps.map(gap => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : (
            <p>No source-level gap was identified by this rule.</p>
          )}
        </section>
        <section>
          <h3>Sources</h3>
          <Sources sources={sources} />
        </section>
        <section>
          <h3>Rule order</h3>
          <ol>
            {summary.ruleOrder.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
        <p className="matching-limitations">{summary.limitations.join(" ")}</p>
      </div>
    </details>
  );
}

function TalentRecommendationControls({
  recommendationId,
}: Readonly<{ recommendationId: string }>) {
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissMatchingRecommendationAction,
    initialMatchingActionState
  );
  const [feedbackState, feedbackAction, feedbackPending] = useActionState(
    recordMatchingFeedbackAction,
    initialMatchingActionState
  );
  const [reportState, reportAction, reportPending] = useActionState(
    reportMatchingRecommendationAction,
    initialMatchingActionState
  );
  return (
    <div className="matching-controls">
      <form action={dismissAction}>
        <input type="hidden" name="recommendationId" value={recommendationId} />
        <input type="hidden" name="detail" value="" />
        <button
          className="matching-button matching-button-secondary"
          type="submit"
          disabled={dismissPending}
        >
          {dismissPending ? "Dismissing…" : "Dismiss"}
        </button>
        <Status state={dismissState} />
      </form>
      <details className="matching-control-detail">
        <summary>Correct this recommendation</summary>
        <form action={feedbackAction}>
          <input
            type="hidden"
            name="recommendationId"
            value={recommendationId}
          />
          <label>
            <span>Feedback reason</span>
            <select name="feedbackType" defaultValue="not_relevant">
              {matchingFeedbackTypes.map(type => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Optional note</span>
            <textarea name="detail" rows={2} maxLength={600} />
          </label>
          <button
            className="matching-button matching-button-secondary"
            type="submit"
            disabled={feedbackPending}
          >
            {feedbackPending ? "Recording…" : "Record feedback"}
          </button>
          <Status state={feedbackState} />
        </form>
      </details>
      <details className="matching-control-detail">
        <summary>Report an issue</summary>
        <form action={reportAction}>
          <input
            type="hidden"
            name="recommendationId"
            value={recommendationId}
          />
          <label>
            <span>Report category</span>
            <select name="feedbackType" defaultValue="missing_source">
              {matchingFeedbackTypes.map(type => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Optional note</span>
            <textarea name="detail" rows={2} maxLength={600} />
          </label>
          <button
            className="matching-button matching-button-danger"
            type="submit"
            disabled={reportPending}
          >
            {reportPending ? "Recording…" : "Report for human review"}
          </button>
          <Status state={reportState} />
        </form>
      </details>
    </div>
  );
}

export function TalentMatchingSurface({
  context,
  savedProjectIds,
}: Readonly<{
  context: TalentMatchingContext;
  savedProjectIds: readonly string[];
}>) {
  return (
    <main className="matching-page">
      <header className="matching-hero">
        <p className="matching-kicker">
          Proof-based discovery / {context.ruleVersion}
        </p>
        <h1>Recommendations you can inspect.</h1>
        <p>
          Only active public human-verified proof and current public project
          requirements are considered. Participation is voluntary, and
          recommendations never make an application or hiring decision.
        </p>
      </header>
      <div className="matching-layout">
        <section
          className="matching-list"
          aria-labelledby="talent-recommendations-title"
        >
          <div className="matching-section-heading">
            <p>Current view</p>
            <h2 id="talent-recommendations-title">
              Projects with source-linked alignment
            </h2>
          </div>
          {context.participationState !== "enabled" ? (
            <div className="matching-empty">
              <h3>Recommendations are paused.</h3>
              <p>
                Enable voluntary project recommendations below to receive
                deterministic discovery results. Nothing is shared with a
                company just by enabling this view.
              </p>
            </div>
          ) : context.items.length ? (
            context.items.map(item => (
              <article className="matching-card" key={item.recommendationId}>
                <div className="matching-card-head">
                  <p className="matching-stamp">
                    Public project / rule {context.ruleVersion}
                  </p>
                  <h3>
                    <Link href={item.project.href as Route}>
                      {item.project.title}
                    </Link>
                  </h3>
                  <p>{item.project.organizationName}</p>
                </div>
                <dl className="matching-skill-ledger">
                  <div>
                    <dt>Required</dt>
                    <dd>
                      {item.project.requiredSkills
                        .map(canonicalSkillLabel)
                        .join(", ") || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt>Helpful</dt>
                    <dd>
                      {item.project.helpfulSkills
                        .map(canonicalSkillLabel)
                        .join(", ") || "Not specified"}
                    </dd>
                  </div>
                </dl>
                <FitExplanation
                  summary={item.fitSummary}
                  sources={item.sources}
                />
                <div className="matching-card-actions">
                  <Link
                    className="matching-button matching-button-primary"
                    href={`${item.project.href}/apply` as Route}
                  >
                    Review before applying
                  </Link>
                  <ProjectSaveControl
                    publicId={item.project.publicId}
                    initiallySaved={savedProjectIds.includes(
                      item.project.publicId
                    )}
                    canSave
                  />
                  <TalentRecommendationControls
                    recommendationId={item.recommendationId}
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="matching-empty">
              <h3>No deterministic recommendations yet.</h3>
              <p>
                This may mean there are no current public projects with an
                explicit matching requirement that overlaps your active public
                human-verified proof. It is not a judgment about skill or
                eligibility.
              </p>
              <Link
                className="matching-button matching-button-secondary"
                href="/projects"
              >
                Browse public projects
              </Link>
            </div>
          )}
        </section>
        <aside className="matching-rail">
          <TalentMatchingPreferences preferences={context.preferences} />
          <section className="matching-note">
            <h2>What this rule excludes</h2>
            <ul>
              {context.limitations.map(limitation => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

function TalentMatchingPreferences({
  preferences,
}: Readonly<{ preferences: MatchingPreferences }>) {
  const [state, action, pending] = useActionState(
    saveMatchingPreferencesAction,
    initialMatchingActionState
  );
  return (
    <section className="matching-preferences">
      <p className="matching-stamp">Your controls</p>
      <h2>Participate on your terms</h2>
      <p>
        These settings control future matching views. They do not publish your
        private profile, messages, or evidence.
      </p>
      <form action={action}>
        <label>
          <span>Project recommendations</span>
          <select
            name="projectRecommendationsState"
            defaultValue={preferences.projectRecommendationsState}
          >
            {matchingParticipationStates.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Company discovery</span>
          <select
            name="companyDiscoverabilityState"
            defaultValue={preferences.companyDiscoverabilityState}
          >
            {matchingParticipationStates.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Current availability</span>
          <select
            name="availabilityStatus"
            defaultValue={preferences.availabilityStatus}
          >
            {matchingAvailabilityStates.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="matching-checkbox">
          <input
            type="checkbox"
            name="shareAvailabilityWithCompanies"
            value="true"
            defaultChecked={preferences.shareAvailabilityWithCompanies}
          />
          <span>
            Share only this availability label with eligible companies.
          </span>
        </label>
        <label>
          <span>Work arrangement</span>
          <select
            name="workArrangement"
            defaultValue={preferences.workArrangement}
          >
            {matchingWorkArrangements.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Timezone (voluntary context)</span>
          <input
            name="timezone"
            defaultValue={preferences.timezone}
            maxLength={80}
          />
        </label>
        <label>
          <span>Application capacity</span>
          <select
            name="applicationCapacity"
            defaultValue={preferences.applicationCapacity}
          >
            {matchingAvailabilityStates.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="matching-button matching-button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save matching controls"}
        </button>
        <Status state={state} />
      </form>
      <p className="matching-muted">
        Set either participation control to withdrawn at any time. Current
        private recommendations and company discoverability are then rechecked
        and unavailable.
      </p>
    </section>
  );
}

export function CompanyMatchingSurface({
  context,
  requiredSkills,
}: Readonly<{
  context: CompanyMatchingContext;
  requiredSkills: CanonicalSkillKey[];
}>) {
  return (
    <main className="matching-page">
      <header className="matching-hero">
        <p className="matching-kicker">
          Private company review / {context.ruleVersion}
        </p>
        <h1>Evidence recommendations, not decisions.</h1>
        <p>
          Only talent who voluntarily enables company discovery and has active
          public human-verified proof can appear. Every item needs an
          accountable human review before any separate application workflow
          action.
        </p>
      </header>
      <div className="matching-layout">
        <section
          className="matching-list"
          aria-labelledby="company-recommendations-title"
        >
          <div className="matching-section-heading">
            <p>
              Current requirement version {context.requirements.version || "—"}
            </p>
            <h2 id="company-recommendations-title">
              Potential evidence alignment
            </h2>
          </div>
          {context.state !== "ready" ? (
            <div className="matching-empty">
              <h3>Recommendations are unavailable.</h3>
              <p>
                First save current matching requirements, then ensure this
                project is a current public accepting-applications project with
                a non-expired deadline.
              </p>
            </div>
          ) : context.items.length ? (
            context.items.map(item => (
              <article className="matching-card" key={item.recommendationId}>
                <div className="matching-card-head">
                  <p className="matching-stamp">
                    Voluntary discovery / public proof
                  </p>
                  <h3>
                    <Link href={item.talent.href as Route}>
                      {item.talent.displayName}
                    </Link>
                  </h3>
                  <p>Availability: {label(item.talent.availability)}</p>
                </div>
                <FitExplanation
                  summary={item.fitSummary}
                  sources={item.sources}
                />
                <HumanReviewControl recommendationId={item.recommendationId} />
              </article>
            ))
          ) : (
            <div className="matching-empty">
              <h3>No deterministic recommendations yet.</h3>
              <p>
                No eligible opted-in talent with active public human-verified
                proof currently overlaps this project’s matching requirements.
                This is not an assessment of the available talent pool.
              </p>
            </div>
          )}
        </section>
        <aside className="matching-rail">
          <ProjectMatchingRequirements
            requirements={context.requirements}
            requiredSkills={requiredSkills}
          />
          <section className="matching-note">
            <h2>Rule limitations</h2>
            <ul>
              {context.limitations.map(limitation => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ProjectMatchingRequirements({
  requirements,
  requiredSkills,
}: Readonly<{
  requirements: MatchingProjectRequirements;
  requiredSkills: CanonicalSkillKey[];
}>) {
  const [state, action, pending] = useActionState(
    saveMatchingProjectRequirementsAction,
    initialMatchingActionState
  );
  const evidenceExpectations = Object.fromEntries(
    requiredSkills.map(skill => [
      skill,
      requirements.requiredEvidenceExpectations[skill] ??
        "human_verified_public_proof",
    ])
  );
  return (
    <section className="matching-preferences">
      <p className="matching-stamp">Versioned requirement input</p>
      <h2>Set evidence expectations</h2>
      <p>
        Required skills come from the private project definition. Matching can
        only use active public human-verified proof; it cannot infer ability or
        alter a candidate workflow.
      </p>
      <form action={action}>
        <input type="hidden" name="projectId" value={requirements.projectId} />
        <input
          type="hidden"
          name="requiredEvidenceExpectations"
          value={JSON.stringify(evidenceExpectations)}
        />
        <label className="matching-checkbox">
          <input
            type="checkbox"
            name="matchingEnabled"
            value="true"
            defaultChecked={requirements.matchingEnabled}
          />
          <span>
            Enable deterministic recommendations for the current eligible public
            project.
          </span>
        </label>
        <div className="matching-skill-check">
          <strong>Required proof expectation</strong>
          {requiredSkills.length ? (
            <ul>
              {requiredSkills.map(skill => (
                <li key={skill}>
                  {canonicalSkillLabel(skill)}{" "}
                  <span>
                    Active public human-verified proof required for positive
                    alignment.
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No required governed skills are available from this project.</p>
          )}
        </div>
        <label>
          <span>Availability expectation</span>
          <select
            name="availabilityExpectation"
            defaultValue={requirements.availabilityExpectation}
          >
            {matchingRequirementAvailabilityStates.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Work arrangement</span>
          <select
            name="workArrangement"
            defaultValue={requirements.workArrangement}
          >
            {matchingWorkArrangements.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Timezone context, not a ranking factor</span>
          <input
            name="timezoneExpectation"
            defaultValue={requirements.timezoneExpectation}
            maxLength={120}
          />
        </label>
        <label>
          <span>Collaboration context</span>
          <textarea
            name="collaborationNeeds"
            defaultValue={requirements.collaborationNeeds}
            rows={3}
            maxLength={360}
          />
        </label>
        <button
          className="matching-button matching-button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save requirement revision"}
        </button>
        <Status state={state} />
      </form>
      <aside className="matching-ai-boundary">
        <strong>Assistive requirement drafting is disabled.</strong>
        <p>
          An approved future adapter may propose an editable, source-linked
          draft with uncertainty. It cannot save facts, invent proof, override
          preference or safety rules, or make a hiring decision.
        </p>
      </aside>
      <p className="matching-muted">
        A new revision is required whenever the underlying project version
        changes. Requirements that use protected characteristics are rejected.
      </p>
    </section>
  );
}

function HumanReviewControl({
  recommendationId,
}: Readonly<{ recommendationId: string }>) {
  const [state, action, pending] = useActionState(
    recordMatchingHumanOverrideAction,
    initialMatchingActionState
  );
  return (
    <details className="matching-human-control">
      <summary>Record an accountable human review action</summary>
      <form action={action}>
        <input type="hidden" name="recommendationId" value={recommendationId} />
        <label>
          <span>Action</span>
          <select name="humanAction" defaultValue="shortlist_for_review">
            {matchingHumanActions.map(value => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Rationale (optional)</span>
          <textarea name="detail" rows={3} maxLength={600} />
        </label>
        <button
          className="matching-button matching-button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? "Recording…" : "Record human action"}
        </button>
        <Status state={state} />
      </form>
      <p>
        This creates an auditable human-review record only. It does not change
        an application, issue an invitation, create a contract, or make a hiring
        decision.
      </p>
    </details>
  );
}

export function MatchingAdministrationSurface({
  summary,
}: Readonly<{ summary: MatchingAdministrationSummary }>) {
  return (
    <main className="matching-page">
      <header className="matching-hero">
        <p className="matching-kicker">Restricted administration</p>
        <h1>Rule, feedback, and fairness ledger.</h1>
        <p>
          Matching remains a deterministic discovery aid. This audit surface
          exposes method boundaries and aggregate review signals, not private
          messages, protected attributes, or an automated hiring queue.
        </p>
      </header>
      <div className="matching-admin-grid">
        <section className="matching-admin-section">
          <h2>Active rules</h2>
          {summary.rules.map(rule => (
            <article key={rule.version}>
              <p className="matching-stamp">
                {rule.state} / {rule.strategy}
              </p>
              <h3>{rule.version}</h3>
              <p>Excluded signals: {rule.excludedSignals.join(", ")}</p>
            </article>
          ))}
        </section>
        <section className="matching-admin-section">
          <h2>Aggregate review signals</h2>
          <dl>
            <div>
              <dt>Active recommendations</dt>
              <dd>{summary.counts.activeRecommendations}</dd>
            </div>
            <div>
              <dt>Feedback records</dt>
              <dd>{summary.counts.feedbackRecords}</dd>
            </div>
            <div>
              <dt>Reports</dt>
              <dd>{summary.counts.reports}</dd>
            </div>
            <div>
              <dt>Human review actions</dt>
              <dd>{summary.counts.humanReviewActions}</dd>
            </div>
          </dl>
          <p className="matching-muted">
            Counts do not establish candidate quality, hiring success, or
            fairness outcomes.
          </p>
        </section>
        <section className="matching-admin-section">
          <h2>Evaluation definitions</h2>
          <ul>
            {summary.metrics.map(metric => (
              <li key={metric.metricKey}>
                <strong>{metric.description}</strong>
                <span>{metric.measurementBoundary}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="matching-admin-section">
          <h2>Recent audit events</h2>
          <ul>
            {summary.audit.length ? (
              summary.audit.map((event, index) => (
                <li key={`${event.eventType}-${event.occurredAt}-${index}`}>
                  <strong>{event.eventType}</strong>
                  <span>
                    {event.ruleVersion || "No rule version"} ·{" "}
                    {event.occurredAt ?? "time unavailable"}
                  </span>
                </li>
              ))
            ) : (
              <li>No matching audit events are available.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
