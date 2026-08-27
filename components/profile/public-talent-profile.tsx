/** Phase 20 style: a calm precision-editorial evidence dossier, never a social profile or scorecard. */
import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import { PublicProfileShare } from "@/components/profile/public-profile-share";
import {
  type PublicWorkEvidenceListItem,
  workEvidenceTypeLabel,
} from "@/lib/evidence/types";
import type { PublicGithubContext } from "@/lib/github/types";
import type { PublicTalentProfile } from "@/lib/profile/context";
import { canonicalSkillLabel } from "@/lib/profile/types";
import { PublicProofGraphView } from "@/components/proof-graph/public-proof-graph";
import type { PublicProofGraph } from "@/lib/proof-graph/types";
import type { PublicTalentProof } from "@/lib/proof/context";

function formatPublicDate(value: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function ExternalLink({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function PublicTalentProfileView({
  profile,
  evidence,
  proofs,
  github,
  graph,
  shareUrl,
}: Readonly<{
  profile: PublicTalentProfile;
  evidence: PublicWorkEvidenceListItem[];
  proofs: PublicTalentProof[];
  github: PublicGithubContext | null;
  graph: PublicProofGraph;
  shareUrl: string;
}>) {
  const hasGithubContext = Boolean(github?.repositories.length);
  const hasLimitedEvidence =
    !evidence.length && !proofs.length && !hasGithubContext;

  return (
    <main id="main-content" className="public-profile-page">
      <header className="public-profile-header">
        <Link href="/" aria-label="Proofly home">
          <BrandMark />
        </Link>
        <span>Public evidence profile · approved public fields only</span>
      </header>
      <article className="public-profile-content">
        <section
          className="public-profile-intro"
          aria-labelledby="public-profile-name"
        >
          <div className="public-profile-intro-topline">
            <p className="profile-kicker">Talent evidence profile</p>
          </div>
          <h1 id="public-profile-name">{profile.displayName}</h1>
          {profile.headline ? (
            <p className="public-profile-headline">{profile.headline}</p>
          ) : null}
          {profile.introduction ? (
            <p className="public-profile-introduction">
              {profile.introduction}
            </p>
          ) : null}
          <dl>
            {profile.developerFocus ? (
              <div>
                <dt>Focus</dt>
                <dd>{profile.developerFocus}</dd>
              </div>
            ) : null}
            {profile.availabilityWindow ? (
              <div>
                <dt>Availability</dt>
                <dd>{profile.availabilityWindow}</dd>
              </div>
            ) : null}
            {profile.timezone ? (
              <div>
                <dt>Timezone</dt>
                <dd>{profile.timezone}</dd>
              </div>
            ) : null}
            {profile.timezoneOverlapPreference ? (
              <div>
                <dt>Timezone overlap</dt>
                <dd>{profile.timezoneOverlapPreference}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="public-profile-primary">
          <section
            id="public-work-evidence"
            className="public-profile-section public-profile-evidence"
            aria-labelledby="public-evidence-title"
          >
            <p className="profile-kicker">Talent-selected evidence</p>
            <h2 id="public-evidence-title">Selected work evidence</h2>
            <p className="public-profile-limit">
              These are contextual records the Talent chose to publish. They are
              not verified proof.
            </p>
            {evidence.length ? (
              <ul className="public-evidence-list">
                {evidence.map(item => (
                  <li key={item.publicId}>
                    <p className="profile-index">
                      {workEvidenceTypeLabel(item.evidenceType)}
                    </p>
                    <h3>{item.title}</h3>
                    <p>{item.shortSummary}</p>
                    <dl className="public-evidence-meta">
                      <div>
                        <dt>Role</dt>
                        <dd>{item.userRole || "Not shared"}</dd>
                      </div>
                      <div>
                        <dt>Skills</dt>
                        <dd>
                          {item.skills.length
                            ? item.skills
                                .map(skill =>
                                  canonicalSkillLabel(skill.skillKey)
                                )
                                .join(", ")
                            : "Not shared"}
                        </dd>
                      </div>
                      <div>
                        <dt>Evidence status</dt>
                        <dd>Talent-published · Not verified</dd>
                      </div>
                    </dl>
                    <Link href={`/evidence/${item.publicId}`}>
                      Read evidence
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="public-profile-empty">
                No selected work evidence has been published.
              </p>
            )}
          </section>

          <section
            className="public-profile-section public-profile-verified-proof"
            aria-labelledby="public-proof-title"
          >
            <p className="profile-kicker">Proofly verification</p>
            <h2 id="public-proof-title">Verified Proof</h2>
            <p className="public-profile-limit">
              Verified Proof is separate from self-described skills,
              Talent-published evidence, and GitHub context. Each active item
              states its method, source evidence, and date.
            </p>
            {proofs.length ? (
              <ul className="public-proof-list">
                {proofs.map(proof => (
                  <li key={proof.id}>
                    <p className="profile-index">Verified · Proofly review</p>
                    <h3>{proof.skillKey}</h3>
                    <dl>
                      <div>
                        <dt>Method</dt>
                        <dd>{proof.verificationMethod}</dd>
                      </div>
                      <div>
                        <dt>Review status</dt>
                        <dd>{proof.reviewStatus}</dd>
                      </div>
                      <div>
                        <dt>Verified</dt>
                        <dd>{formatPublicDate(proof.verifiedAt)}</dd>
                      </div>
                      {proof.reviewerAttribution ? (
                        <div>
                          <dt>Attribution</dt>
                          <dd>{proof.reviewerAttribution}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <Link href={`/evidence/${proof.evidencePublicId}`}>
                      Review source evidence
                      {proof.evidenceTitle ? `: ${proof.evidenceTitle}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="public-profile-empty">
                No active verified Proof is published at this time. Revoked and
                expired Proof is not presented as active verification.
              </p>
            )}
          </section>
          <PublicProofGraphView graph={graph} />
        </div>

        <aside
          className="public-profile-secondary"
          aria-label="Profile context and actions"
        >
          <section
            className="public-profile-section public-profile-action"
            aria-labelledby="public-profile-action-title"
          >
            <p className="profile-kicker">Company next step</p>
            <h2 id="public-profile-action-title">Review the work context</h2>
            <p>
              Compare published evidence, active verified Proof, and selected
              GitHub context as distinct sources before making your own
              assessment.
            </p>
            <a className="button button-primary" href="#public-work-evidence">
              Review selected evidence
            </a>
            <p className="public-profile-action-note">
              Private contact details are not displayed. Contact and opportunity
              workflows appear only after explicit Talent controls and verified
              company access are available.
            </p>
          </section>

          <section
            className="public-profile-section public-profile-share-section"
            aria-labelledby="public-share-title"
          >
            <p className="profile-kicker">Share</p>
            <h2 id="public-share-title">A stable public link</h2>
            <PublicProfileShare
              profileUrl={shareUrl}
              profileName={profile.displayName}
            />
          </section>

          {hasLimitedEvidence ? (
            <section
              className="public-profile-section public-profile-limited"
              aria-labelledby="public-limited-title"
            >
              <p className="profile-kicker">Profile status</p>
              <h2 id="public-limited-title">Published with limited evidence</h2>
              <p>
                This Talent has published an identity and work direction, but
                has not selected public work evidence, active verified Proof, or
                GitHub context yet.
              </p>
            </section>
          ) : null}

          <section
            className="public-profile-section"
            aria-labelledby="public-skills-title"
          >
            <p className="profile-kicker">Self-described skills</p>
            <h2 id="public-skills-title">Claimed skills</h2>
            <p className="public-profile-limit">
              These are self-described claims with context. They are not
              verified proof.
            </p>
            {profile.skills.length ? (
              <ul className="public-profile-skills">
                {profile.skills.map(skill => (
                  <li key={skill.skillKey}>
                    <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                    <span>Claimed · {skill.claimedLevel}</span>
                    {skill.context ? <p>{skill.context}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="public-profile-empty">
                No claimed skills have been published.
              </p>
            )}
          </section>

          {github?.repositories.length ? (
            <section
              className="public-profile-section public-profile-github"
              aria-labelledby="public-github-title"
            >
              <p className="profile-kicker">Source context / GitHub</p>
              <h2 id="public-github-title">Selected public GitHub context</h2>
              <p className="public-profile-limit">
                These repositories are public GitHub context selected by the
                Talent. They are not Proofly-reviewed proof, skill verification,
                or an employment claim.
              </p>
              <dl className="public-github-meta">
                <div>
                  <dt>Source account</dt>
                  <dd>
                    <ExternalLink href={github.profileUrl}>
                      @{github.username}
                    </ExternalLink>
                  </dd>
                </div>
                <div>
                  <dt>Last synchronized</dt>
                  <dd>{formatPublicDate(github.lastSyncedAt)}</dd>
                </div>
                <div>
                  <dt>Context status</dt>
                  <dd>Not verified</dd>
                </div>
              </dl>
              <ul className="public-github-repositories">
                {github.repositories.map(repository => (
                  <li key={repository.sourceUrl}>
                    <p className="profile-index">
                      GitHub repository · contextual
                    </p>
                    <h3>
                      <ExternalLink href={repository.sourceUrl}>
                        {repository.fullName}
                      </ExternalLink>
                    </h3>
                    {repository.description ? (
                      <p>{repository.description}</p>
                    ) : null}
                    <span>
                      {repository.primaryLanguage || "Language not reported"} ·{" "}
                      {repository.isFork ? "Fork" : "Repository"}
                      {repository.isArchived ? " · Archived" : ""}
                    </span>
                    <small>{repository.contributionContext}</small>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {profile.links.length ? (
            <section
              className="public-profile-section"
              aria-labelledby="public-links-title"
            >
              <p className="profile-kicker">Links</p>
              <h2 id="public-links-title">Chosen public links</h2>
              <ul className="public-profile-links">
                {profile.links.map(link => (
                  <li key={link.url}>
                    <ExternalLink href={link.url}>
                      {link.label || link.linkType}
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </article>
    </main>
  );
}
