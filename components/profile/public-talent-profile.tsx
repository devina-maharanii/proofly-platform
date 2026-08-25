import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import {
  type PublicWorkEvidenceListItem,
  workEvidenceTypeLabel,
} from "@/lib/evidence/types";
import type { PublicGithubContext } from "@/lib/github/types";
import { canonicalSkillLabel } from "@/lib/profile/types";
import type { PublicTalentProfile } from "@/lib/profile/context";

export function PublicTalentProfileView({
  profile,
  evidence,
  github,
}: Readonly<{
  profile: PublicTalentProfile;
  evidence: PublicWorkEvidenceListItem[];
  github: PublicGithubContext | null;
}>) {
  return (
    <main id="main-content" className="public-profile-page">
      <header className="public-profile-header">
        <Link href="/" aria-label="Proofly home">
          <BrandMark />
        </Link>
        <span>Talent profile · public fields only</span>
      </header>
      <article className="public-profile-content">
        <section className="public-profile-intro">
          <p className="profile-kicker">Talent profile</p>
          <h1>{profile.displayName}</h1>
          <p className="public-profile-headline">{profile.headline}</p>
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
            {profile.currentExperienceLevel ? (
              <div>
                <dt>Experience</dt>
                <dd>{profile.currentExperienceLevel}</dd>
              </div>
            ) : null}
            {profile.locationName ? (
              <div>
                <dt>Location</dt>
                <dd>{profile.locationName}</dd>
              </div>
            ) : null}
            {profile.timezone ? (
              <div>
                <dt>Timezone</dt>
                <dd>{profile.timezone}</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <section
          className="public-profile-section"
          aria-labelledby="public-skills-title"
        >
          <p className="profile-kicker">Skills</p>
          <h2 id="public-skills-title">Claimed skills</h2>
          <p className="public-profile-limit">
            These are self-described claims with context. They are not verified
            proof.
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
        <section
          className="public-profile-section"
          aria-labelledby="public-work-title"
        >
          <p className="profile-kicker">Work direction</p>
          <h2 id="public-work-title">Preferences shared publicly</h2>
          <dl className="public-profile-preferences">
            {profile.preferredProjectTypes.length ? (
              <div>
                <dt>Project types</dt>
                <dd>{profile.preferredProjectTypes.join(", ")}</dd>
              </div>
            ) : null}
            {profile.availabilityWindow ? (
              <div>
                <dt>Availability</dt>
                <dd>{profile.availabilityWindow}</dd>
              </div>
            ) : null}
            {profile.engagementPreference ? (
              <div>
                <dt>Engagement</dt>
                <dd>{profile.engagementPreference}</dd>
              </div>
            ) : null}
            {profile.timezoneOverlapPreference ? (
              <div>
                <dt>Timezone overlap</dt>
                <dd>{profile.timezoneOverlapPreference}</dd>
              </div>
            ) : null}
            {profile.remoteCollaborationPreference ? (
              <div>
                <dt>Collaboration</dt>
                <dd>{profile.remoteCollaborationPreference}</dd>
              </div>
            ) : null}
            {profile.targetOpportunityType ? (
              <div>
                <dt>Opportunity type</dt>
                <dd>{profile.targetOpportunityType}</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <section
          className="public-profile-section public-profile-proof"
          aria-labelledby="public-proof-title"
        >
          <p className="profile-kicker">Evidence</p>
          <h2 id="public-proof-title">Work evidence</h2>
          <p>
            These are contextual records the Talent chose to publish. They are
            not independently verified proof.
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
                  <span>
                    {item.userRole || "Role not shared"} · v{item.sourceVersion}{" "}
                    · Not verified
                  </span>
                  <a href={`/evidence/${item.publicId}`}>Read evidence →</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-profile-empty">
              No work evidence has been published.
            </p>
          )}
        </section>
        {github?.repositories.length ? (
          <section
            className="public-profile-section public-profile-github"
            aria-labelledby="public-github-title"
          >
            <p className="profile-kicker">Source context / GitHub</p>
            <h2 id="public-github-title">Selected public GitHub work</h2>
            <p className="public-profile-limit">
              These repositories are public GitHub context selected by the
              Talent. They are not Proofly-reviewed proof, skill verification,
              or an employment claim.
            </p>
            <dl className="public-github-meta">
              <div>
                <dt>Source account</dt>
                <dd>
                  <a href={github.profileUrl} rel="noreferrer">
                    @{github.username}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Last synchronized</dt>
                <dd>
                  {github.lastSyncedAt
                    ? new Date(github.lastSyncedAt).toLocaleDateString()
                    : "Not available"}
                </dd>
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
                    <a href={repository.sourceUrl} rel="noreferrer">
                      {repository.fullName}
                    </a>
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
                  <a href={link.url} rel="noreferrer">
                    {link.label || link.linkType}{" "}
                    <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}
