/** Evidence Ledger Editorial — Phase 30 shows only active, human-verified, source-linked Proof context. */
import Link from "next/link";

import { canonicalSkillLabel } from "@/lib/profile/types";
import type { PublicProofGraph } from "@/lib/proof-graph/types";

function formatDate(value: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

const outcomeLabel: Record<string, string> = {
  completed_on_time: "Completed on time",
  revision_accepted: "Revision accepted",
  outcome_confirmed: "Outcome confirmed",
};

export function PublicProofGraphView({
  graph,
}: Readonly<{ graph: PublicProofGraph }>) {
  const hasGraph = graph.timeline.length > 0;
  return (
    <section
      id="public-proof-graph"
      className="public-profile-section public-proof-graph"
      aria-labelledby="public-proof-graph-title"
    >
      <p className="profile-kicker">Explainable Proof graph</p>
      <h2 id="public-proof-graph-title">How active Proof connects</h2>
      <p className="public-profile-limit">
        This record traces active human-verified Proof to the public evidence
        selected by the Talent. It is contextual, source-linked information —
        not a score, ranking, or hiring recommendation.
      </p>
      {hasGraph ? (
        <>
          <dl
            className="proof-graph-summary"
            aria-label="Proof context summary"
          >
            <div>
              <dt>Active Proof</dt>
              <dd>{graph.summary.activeVerifiedProofCount}</dd>
            </div>
            <div>
              <dt>Verified skills</dt>
              <dd>{graph.summary.verifiedSkillCount}</dd>
            </div>
            <div>
              <dt>Consented outcomes</dt>
              <dd>{graph.summary.consentedCompanyOutcomeCount}</dd>
            </div>
          </dl>

          <ol
            className="proof-graph-timeline"
            aria-label="Active Proof timeline"
          >
            {graph.timeline.map(item => (
              <li key={item.proofId}>
                <p className="profile-index">Human-verified · Source linked</p>
                <h3>{canonicalSkillLabel(item.skillKey)}</h3>
                <dl>
                  <div>
                    <dt>Evidence</dt>
                    <dd>
                      <Link href={`/evidence/${item.evidencePublicId}`}>
                        {item.evidenceTitle || "View published source evidence"}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Verification</dt>
                    <dd>{item.verificationMethod || "Human review"}</dd>
                  </div>
                  <div>
                    <dt>Verified</dt>
                    <dd>{formatDate(item.verifiedAt)}</dd>
                  </div>
                  {item.projectPublicId && item.projectTitle ? (
                    <div>
                      <dt>Project context</dt>
                      <dd>
                        <Link href={`/projects/${item.projectPublicId}`}>
                          {item.projectTitle}
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                  {item.reviewerAttribution ? (
                    <div>
                      <dt>Reviewer attribution</dt>
                      <dd>{item.reviewerAttribution}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ol>

          <section
            className="proof-graph-skill-evidence"
            aria-labelledby="proof-graph-skills-title"
          >
            <p className="profile-kicker">Skill to evidence</p>
            <h3 id="proof-graph-skills-title">Verified skills, with sources</h3>
            <ul>
              {graph.skills.map(skill => (
                <li key={skill.skillKey}>
                  <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                  <span>
                    {skill.proofCount} active Proof item
                    {skill.proofCount === 1 ? "" : "s"}
                  </span>
                  <div>
                    {skill.evidence.map(evidence => (
                      <Link
                        key={evidence.proofId}
                        href={`/evidence/${evidence.evidencePublicId}`}
                      >
                        {evidence.evidenceTitle || "Published evidence"}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {graph.companyOutcomes.length || graph.endorsements.length ? (
            <section
              className="proof-graph-context"
              aria-labelledby="proof-graph-context-title"
            >
              <p className="profile-kicker">Talent-consented context</p>
              <h3 id="proof-graph-context-title">
                Company context, not a rating
              </h3>
              {graph.companyOutcomes.length ? (
                <ul>
                  {graph.companyOutcomes.map(outcome => (
                    <li key={outcome.id}>
                      <strong>
                        {outcomeLabel[outcome.outcomeType] ??
                          "Company outcome context"}
                      </strong>
                      <p>{outcome.contextSummary}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {graph.endorsements.length ? (
                <ul>
                  {graph.endorsements.map(endorsement => (
                    <li key={endorsement.id}>
                      <strong>
                        {canonicalSkillLabel(endorsement.skillKey)}
                      </strong>
                      <p>{endorsement.endorsementText}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </>
      ) : (
        <p className="public-profile-empty">
          No active public Proof graph is available. Private, expired, revoked,
          and unconsented records are not shown here.
        </p>
      )}
    </section>
  );
}
