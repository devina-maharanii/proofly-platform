/** Phase 21 style: a precision-editorial public company context record, not a directory listing, job board, or reputation scorecard. */
import Link from "next/link";

import { BrandMark } from "@/components/marketing/brand-mark";
import { PublicProfileShare } from "@/components/profile/public-profile-share";
import type { PublicCompanyProfile } from "@/lib/company/context";

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
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} <span aria-hidden="true">↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function ListOrEmpty({
  items,
  empty,
}: Readonly<{ items: string[]; empty: string }>) {
  return items.length ? (
    <ul className="company-public-tags">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="public-profile-empty">{empty}</p>
  );
}

export function PublicCompanyProfileView({
  profile,
  shareUrl,
}: Readonly<{ profile: PublicCompanyProfile; shareUrl: string }>) {
  return (
    <main id="main-content" className="public-profile-page company-public-page">
      <header className="public-profile-header">
        <Link href="/" aria-label="Proofly home">
          <BrandMark />
        </Link>
        <span>Public company context · approved public fields only</span>
      </header>
      <article className="public-profile-content">
        <section
          className="public-profile-intro company-public-intro"
          aria-labelledby="company-profile-name"
        >
          <p className="profile-kicker">Company context record</p>
          <h1 id="company-profile-name">{profile.name}</h1>
          {profile.shortDescription ? (
            <p className="public-profile-headline">
              {profile.shortDescription}
            </p>
          ) : null}
          <dl>
            <div>
              <dt>Industry</dt>
              <dd>{profile.industry || "Not shared"}</dd>
            </div>
            <div>
              <dt>Company size</dt>
              <dd>{profile.companySize || "Not shared"}</dd>
            </div>
            {profile.foundedYear ? (
              <div>
                <dt>Founded</dt>
                <dd>{profile.foundedYear}</dd>
              </div>
            ) : null}
            <div>
              <dt>Organization confirmation</dt>
              <dd>
                {profile.organizationConfirmation === "not_confirmed"
                  ? "Not confirmed in Proofly"
                  : profile.organizationConfirmation}
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatPublicDate(profile.updatedAt)}</dd>
            </div>
          </dl>
        </section>
        <div className="public-profile-primary">
          <section
            className="public-profile-section company-public-work"
            aria-labelledby="company-work-title"
          >
            <p className="profile-kicker">Work context</p>
            <h2 id="company-work-title">
              What this company makes and how work happens
            </h2>
            <p className="public-profile-limit">
              This is company-provided context. It is not organizational
              verification, a project specification, or a promise of available
              work.
            </p>
            {profile.whatWeBuild ? (
              <p className="company-public-copy">{profile.whatWeBuild}</p>
            ) : (
              <p className="public-profile-empty">
                No public work context has been added.
              </p>
            )}
            <div className="company-public-context-grid">
              <div>
                <h3>Engineering practices</h3>
                <ListOrEmpty
                  items={profile.engineeringPractices}
                  empty="Not shared"
                />
              </div>
              <div>
                <h3>Technology areas</h3>
                <ListOrEmpty
                  items={profile.technologyAreas}
                  empty="Not shared"
                />
              </div>
              <div>
                <h3>Collaboration</h3>
                <p>{profile.collaborationStyle || "Not shared"}</p>
              </div>
              <div>
                <h3>Working overlap</h3>
                <p>{profile.timezoneOverlap || "Not shared"}</p>
              </div>
              <div>
                <h3>Location preference</h3>
                <p>{profile.workLocationPreference || "Not shared"}</p>
              </div>
              <div>
                <h3>Typical work</h3>
                <ListOrEmpty
                  items={profile.typicalProjectTypes}
                  empty="Not shared"
                />
              </div>
            </div>
          </section>
          <section
            className="public-profile-section company-public-hiring"
            aria-labelledby="company-hiring-title"
          >
            <p className="profile-kicker">Hiring context</p>
            <h2 id="company-hiring-title">
              Context for a future human conversation
            </h2>
            <p className="public-profile-limit">
              This page does not publish a role, accept applications, enable
              messages, or make a hiring decision.
            </p>
            <dl className="company-public-detail-list">
              <div>
                <dt>Focus</dt>
                <dd>{profile.hiringFocus || "Not shared"}</dd>
              </div>
              <div>
                <dt>Engagement context</dt>
                <dd>
                  {profile.engagementTypes.length
                    ? profile.engagementTypes.join(", ")
                    : "Not shared"}
                </dd>
              </div>
              <div>
                <dt>Open to future opportunities</dt>
                <dd>
                  {profile.activeOpportunities
                    ? "The company has indicated general openness; no opportunity is published here."
                    : "Not indicated"}
                </dd>
              </div>
              <div>
                <dt>Response expectations</dt>
                <dd>{profile.responseExpectations || "Not shared"}</dd>
              </div>
            </dl>
            {profile.reviewTrialPhilosophy ? (
              <div className="company-public-principles">
                <h3>Evaluation principles</h3>
                <p>{profile.reviewTrialPhilosophy}</p>
              </div>
            ) : null}
          </section>
          <section
            className="public-profile-section company-public-projects"
            aria-labelledby="company-projects-title"
          >
            <p className="profile-kicker">Published work context</p>
            <h2 id="company-projects-title">
              Projects, outcomes, and testimonials
            </h2>
            <p className="public-profile-limit">
              Project creation and public outcomes are not part of this phase.
              No project, outcome, or testimonial is shown without a real,
              consented source record.
            </p>
            <p className="public-profile-empty">
              No published projects, outcomes, or testimonials are available.
            </p>
          </section>
        </div>
        <aside
          className="public-profile-secondary"
          aria-label="Company profile context and actions"
        >
          <section
            className="public-profile-section public-profile-action"
            aria-labelledby="company-members-title"
          >
            <p className="profile-kicker">Member attribution</p>
            <h2 id="company-members-title">People who chose to be listed</h2>
            <p className="public-profile-limit">
              Names appear only when each member has separately opted into
              public company attribution. Past membership is labeled as
              historical context.
            </p>
            {profile.members.length ? (
              <ul className="company-public-members">
                {profile.members.map(member => (
                  <li key={`${member.displayName}-${member.roleLabel}`}>
                    <strong>{member.displayName}</strong>
                    <span>
                      {member.roleLabel || "Company member"} ·{" "}
                      {member.status === "active"
                        ? "Active attribution"
                        : "Historical attribution"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="public-profile-empty">
                No members have chosen public attribution.
              </p>
            )}
          </section>
          <section
            className="public-profile-section public-profile-share-section"
            aria-labelledby="company-share-title"
          >
            <p className="profile-kicker">Share</p>
            <h2 id="company-share-title">A stable public company link</h2>
            <PublicProfileShare
              profileUrl={shareUrl}
              profileName={profile.name}
            />
          </section>
          <section
            className="public-profile-section company-public-boundary"
            aria-labelledby="company-boundary-title"
          >
            <p className="profile-kicker">Trust boundary</p>
            <h2 id="company-boundary-title">
              What this page does not establish
            </h2>
            <p>
              It does not establish organization verification, an available
              role, employment eligibility, payment terms, a response promise,
              or a private contact channel.
            </p>
            {profile.websiteUrl ? (
              <ExternalLink href={profile.websiteUrl}>
                Visit the company website
              </ExternalLink>
            ) : null}
          </section>
        </aside>
      </article>
    </main>
  );
}
