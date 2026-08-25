import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import {
  workEvidenceStateLabel,
  workEvidenceTypeLabel,
  type PublicWorkEvidence,
} from "@/lib/evidence/types";
import { canonicalSkillLabel } from "@/lib/profile/types";

export function PublicWorkEvidenceView({
  evidence,
}: Readonly<{ evidence: PublicWorkEvidence }>) {
  return (
    <main
      className="public-profile-page public-evidence-page"
      id="main-content"
    >
      <header className="public-profile-header">
        <Link href="/" aria-label="Proofly home">
          <BrandMark />
        </Link>
        <span>Work evidence · public snapshot</span>
      </header>
      <article className="public-evidence-content">
        <section className="public-evidence-hero">
          <p className="profile-kicker">
            {workEvidenceTypeLabel(evidence.evidenceType)}
          </p>
          <h1>{evidence.title}</h1>
          <p>{evidence.shortSummary}</p>
          <dl className="public-profile-preferences">
            <div>
              <dt>Role</dt>
              <dd>{evidence.userRole}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>v{evidence.sourceVersion}</dd>
            </div>
            <div>
              <dt>Presentation</dt>
              <dd>{workEvidenceStateLabel(evidence.state)}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>Not verified</dd>
            </div>
          </dl>
        </section>
        <section className="public-profile-section">
          <p className="profile-kicker">Context</p>
          <h2>Problem and contribution</h2>
          <div className="evidence-case-study">
            <div>
              <h3>Problem or goal</h3>
              <p>{evidence.problemGoal || "Not shared."}</p>
            </div>
            <div>
              <h3>Personal contribution</h3>
              <p>{evidence.personalContribution || "Not shared."}</p>
            </div>
            <div>
              <h3>Scope</h3>
              <p>{evidence.contributionScope || "Not shared."}</p>
            </div>
          </div>
        </section>
        <section className="public-profile-section">
          <p className="profile-kicker">Decisions</p>
          <h2>Constraints, tradeoffs, and outcome</h2>
          <div className="evidence-case-study">
            <div>
              <h3>Context and constraints</h3>
              <p>{evidence.contextConstraints || "Not shared."}</p>
            </div>
            <div>
              <h3>Decisions and tradeoffs</h3>
              <p>{evidence.decisionsTradeoffs || "Not shared."}</p>
            </div>
            <div>
              <h3>Outcome or current status</h3>
              <p>{evidence.outcomeStatus || "Not shared."}</p>
            </div>
          </div>
        </section>
        <section className="public-profile-section">
          <p className="profile-kicker">Skills</p>
          <h2>Contextual software skills</h2>
          <p className="public-profile-limit">
            These references preserve the taxonomy version used by this record.
            They are not a score, automated inference, or verified proof.
          </p>
          {evidence.skills.length ? (
            <ul className="public-profile-skills">
              {evidence.skills.map(skill => (
                <li key={skill.skillKey}>
                  <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                  {skill.context ? <p>{skill.context}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile-empty">
              No skills were shared publicly.
            </p>
          )}
        </section>
        <section className="public-profile-section public-profile-proof">
          <p className="profile-kicker">Attribution and verification</p>
          <h2>
            {evidence.teamWork
              ? "Collaborative work disclosed"
              : "Manual work evidence"}
          </h2>
          <p>
            {evidence.teamWork
              ? "This record names collaborators or source context below. The stated contribution belongs to the Talent, not the entire project outcome."
              : "This record is a self-published account of work. It is not independently verified proof."}
          </p>
          {evidence.attributions.length ? (
            <ul className="public-profile-links">
              {evidence.attributions.map(attribution => (
                <li key={attribution.contributorName}>
                  <strong>{attribution.contributorName}</strong>
                  {attribution.contributorRole
                    ? ` · ${attribution.contributorRole}`
                    : ""}
                  {attribution.sourceReferenceUrl ? (
                    <a href={attribution.sourceReferenceUrl} rel="noreferrer">
                      Source ↗
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="public-profile-section">
          <p className="profile-kicker">References</p>
          <h2>Links and availability</h2>
          {evidence.links.length ? (
            <ul className="public-profile-links">
              {evidence.links.map(link => (
                <li key={`${link.label}-${link.linkType}`}>
                  <strong>
                    {link.label || link.linkType.replaceAll("_", " ")}
                  </strong>
                  {link.availability === "available" && link.url ? (
                    <a href={link.url} rel="noreferrer">
                      Open reference ↗
                    </a>
                  ) : (
                    <span className="evidence-link-fallback">
                      {link.availability === "private"
                        ? "Private reference — unavailable publicly"
                        : "Reference currently unavailable"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile-empty">
              No public references were shared.
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
