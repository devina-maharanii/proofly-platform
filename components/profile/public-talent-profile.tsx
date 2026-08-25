import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import { canonicalSkillLabel } from "@/lib/profile/types";
import type { PublicTalentProfile } from "@/lib/profile/context";

export function PublicTalentProfileView({
  profile,
}: Readonly<{ profile: PublicTalentProfile }>) {
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
          <h2 id="public-proof-title">{profile.proofStatus}</h2>
          <p>
            Work evidence can be linked here only after it exists in an approved
            evidence phase. This profile does not turn activity or
            self-description into proof.
          </p>
        </section>
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
