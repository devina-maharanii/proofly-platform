"use client";

/** Evidence Ledger Editorial — Phase 30 keeps consent decisions and audit provenance in the Talent’s private dossier. */
import { useActionState } from "react";
import Link from "next/link";

import {
  consentCompanyProofOutcomeAction,
  consentProofEndorsementAction,
  withdrawCompanyProofOutcomeConsentAction,
  withdrawProofEndorsementAction,
} from "@/lib/proof-graph/actions";
import {
  initialProofGraphActionState,
  proofRelationshipStateLabel,
  type TalentProofGraphAudit,
} from "@/lib/proof-graph/types";
import { canonicalSkillLabel } from "@/lib/profile/types";

function formatDate(value: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function OutcomeControl({
  outcome,
}: Readonly<{ outcome: TalentProofGraphAudit["outcomes"][number] }>) {
  const [state, action, pending] = useActionState(
    outcome.state === "proposed"
      ? consentCompanyProofOutcomeAction
      : withdrawCompanyProofOutcomeConsentAction,
    initialProofGraphActionState
  );
  if (outcome.state === "withdrawn") return null;
  return (
    <form action={action} className="proof-audit-control">
      <input type="hidden" name="outcomeId" value={outcome.id} />
      <button
        className="button button-secondary"
        type="submit"
        disabled={pending}
      >
        {pending
          ? "Updating…"
          : outcome.state === "proposed"
            ? "Make public with my consent"
            : "Withdraw public consent"}
      </button>
      {state.status !== "idle" ? <p role="status">{state.message}</p> : null}
    </form>
  );
}

function EndorsementControl({
  endorsement,
}: Readonly<{ endorsement: TalentProofGraphAudit["endorsements"][number] }>) {
  const [state, action, pending] = useActionState(
    endorsement.state === "proposed"
      ? consentProofEndorsementAction
      : withdrawProofEndorsementAction,
    initialProofGraphActionState
  );
  if (endorsement.state === "withdrawn") return null;
  return (
    <form action={action} className="proof-audit-control">
      <input type="hidden" name="endorsementId" value={endorsement.id} />
      <button
        className="button button-secondary"
        type="submit"
        disabled={pending}
      >
        {pending
          ? "Updating…"
          : endorsement.state === "proposed"
            ? "Make public with my consent"
            : "Withdraw public consent"}
      </button>
      {state.status !== "idle" ? <p role="status">{state.message}</p> : null}
    </form>
  );
}

export function PrivateProofGraphAudit({
  audit,
}: Readonly<{ audit: TalentProofGraphAudit }>) {
  return (
    <main id="main-content" className="proof-audit-page">
      <header className="proof-audit-header">
        <Link href="/" aria-label="Proofly home">
          Proofly
        </Link>
        <span>Private Proof record · Talent controls</span>
      </header>
      <article className="proof-audit-content">
        <section
          className="proof-audit-intro"
          aria-labelledby="proof-audit-title"
        >
          <p className="profile-kicker">Proof Graph audit</p>
          <h1 id="proof-audit-title">Your Proof, with its source trail.</h1>
          <p>
            Review the retained, source-linked reputation events behind your
            public Proof. This page is private. It never publishes a record
            without your separate consent.
          </p>
        </section>

        <section
          className="proof-audit-section"
          aria-labelledby="proof-consent-title"
        >
          <p className="profile-kicker">Consent controls</p>
          <h2 id="proof-consent-title">Company context awaiting your choice</h2>
          <p className="public-profile-limit">
            A company may propose context for a verified Proof, but it stays
            private until you consent. You may later withdraw public consent;
            the audit trail is retained privately.
          </p>
          {audit.outcomes.length ? (
            <ul className="proof-audit-list">
              {audit.outcomes.map(outcome => (
                <li key={outcome.id}>
                  <p className="profile-index">
                    Outcome · {proofRelationshipStateLabel[outcome.state]}
                  </p>
                  <h3>{outcome.outcomeType.replaceAll("_", " ")}</h3>
                  <p>{outcome.contextSummary}</p>
                  <small>Proposed {formatDate(outcome.proposedAt)}</small>
                  <OutcomeControl outcome={outcome} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile-empty">
              No company outcome context is awaiting or using your consent.
            </p>
          )}
        </section>

        <section
          className="proof-audit-section"
          aria-labelledby="proof-endorsement-title"
        >
          <p className="profile-kicker">Consent controls</p>
          <h2 id="proof-endorsement-title">Company endorsements</h2>
          {audit.endorsements.length ? (
            <ul className="proof-audit-list">
              {audit.endorsements.map(endorsement => (
                <li key={endorsement.id}>
                  <p className="profile-index">
                    {proofRelationshipStateLabel[endorsement.state]}
                  </p>
                  <h3>{canonicalSkillLabel(endorsement.skillKey)}</h3>
                  <p>{endorsement.endorsementText}</p>
                  <small>Proposed {formatDate(endorsement.proposedAt)}</small>
                  <EndorsementControl endorsement={endorsement} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile-empty">
              No company endorsement has been recorded for your consent.
            </p>
          )}
        </section>

        <section
          className="proof-audit-section"
          aria-labelledby="proof-ledger-title"
        >
          <p className="profile-kicker">Append-only record</p>
          <h2 id="proof-ledger-title">Reputation event ledger</h2>
          <p className="public-profile-limit">
            Events cite their source type and identifier. Corrections and
            withdrawals append new records rather than rewriting prior history.
          </p>
          {audit.events.length ? (
            <ol className="proof-audit-ledger">
              {audit.events.map(event => (
                <li key={event.id}>
                  <div>
                    <strong>{event.eventType.replaceAll(".", " · ")}</strong>
                    <span>{event.visibility}</span>
                  </div>
                  <p>{event.eventSummary}</p>
                  <small>
                    {formatDate(event.occurredAt)} · source:{" "}
                    {event.sourceEventType}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="public-profile-empty">
              No Proof Graph events are available yet.
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
