"use client";

/** Phase 21 style: a private, organization-scoped editorial workspace for truthful company context; no project, hiring, billing, or administration UI. */
import { useActionState, useState } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  hideCompanyProfileAction,
  prepareCompanyProfilePreviewAction,
  publishCompanyProfileAction,
  saveCompanyProfileAction,
} from "@/lib/company/actions";
import {
  initialCompanyProfileActionState,
  type CompanyProfileActionState,
  type CompanyProfileContext,
} from "@/lib/company/types";

function Status({ state }: Readonly<{ state: CompanyProfileActionState }>) {
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
}: Readonly<{ state: CompanyProfileActionState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="profile-field-error">{message}</p> : null;
}

function PrivatePreview({
  context,
}: Readonly<{ context: CompanyProfileContext }>) {
  const { profile } = context;
  return (
    <section
      className="profile-preview"
      aria-labelledby="company-preview-title"
    >
      <div className="profile-preview-heading">
        <div>
          <p className="profile-kicker">Private preview</p>
          <h2 id="company-preview-title">How this company context reads</h2>
        </div>
        <span className="profile-state-badge">
          {profile.draftState.replaceAll("_", " ")}
        </span>
      </div>
      <div className="profile-preview-surface company-preview-surface">
        <p className="profile-preview-name">{profile.name || "Company name"}</p>
        <p className="profile-preview-headline">
          {profile.shortDescription ||
            "A concise description of the company belongs here."}
        </p>
        <dl className="profile-preview-meta">
          <div>
            <dt>Work context</dt>
            <dd>{profile.whatWeBuild || "Not added"}</dd>
          </div>
          <div>
            <dt>Hiring context</dt>
            <dd>{profile.hiringFocus || "Not added"}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>/companies/{profile.slug || "company"}</dd>
          </div>
        </dl>
        <p className="profile-proof-boundary">
          <strong>Trust boundary:</strong> organization confirmation, open
          roles, contact details, and hiring decisions are not implied by this
          page.
        </p>
        <p className="profile-proof-boundary">
          <strong>Public field review:</strong> the name, stable address, and
          the work and hiring context shown above are the approved profile
          content. Private organization records, contact details, billing, and
          workspace settings remain outside this public page.
        </p>
      </div>
    </section>
  );
}

export function CompanyProfileEditor({
  context,
}: Readonly<{ context: CompanyProfileContext }>) {
  const { profile, publication, attribution, activeCompanyContext } = context;
  const [saveState, saveAction] = useActionState(
    saveCompanyProfileAction,
    initialCompanyProfileActionState
  );
  const [previewState, previewAction] = useActionState(
    prepareCompanyProfilePreviewAction,
    initialCompanyProfileActionState
  );
  const [publishState, publishAction] = useActionState(
    publishCompanyProfileAction,
    initialCompanyProfileActionState
  );
  const [hideState, hideAction] = useActionState(
    hideCompanyProfileAction,
    initialCompanyProfileActionState
  );
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  if (!activeCompanyContext) {
    return (
      <AuthShell
        eyebrow="Company profile"
        title="Switch to an active company context"
        description="Company profiles belong to an organization. Select an active company membership before viewing or changing this private draft."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose a company context
        </Link>
      </AuthShell>
    );
  }

  if (!attribution.canEdit) {
    return (
      <AuthShell
        eyebrow="Company profile"
        title="This membership cannot edit the company profile"
        description="An organization owner or an authorized hiring member can prepare company context. This page does not create private administration access."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose another context
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Company profile"
      title="Explain the company context without making a hiring promise"
      description="Save a private organization draft first. Only an owner can publish approved company context; public member attribution requires each person’s separate consent."
    >
      <nav className="profile-nav" aria-label="Company profile sections">
        <a href="#identity">Identity</a>
        <a href="#work">Work context</a>
        <a href="#hiring">Hiring context</a>
        <a href="#attribution">Attribution</a>
        <a href="#preview">Preview</a>
      </nav>
      <div className="profile-layout company-profile-layout">
        <form action={saveAction} className="profile-editor-form">
          <section
            className="profile-section"
            id="identity"
            aria-labelledby="company-identity-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">01 / identity</p>
              <h2 id="company-identity-title">
                Use the organization’s established name and public address
              </h2>
              <p>
                The name and address come from the organization context created
                during onboarding. This page does not change organization
                ownership or private membership administration.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Company name</span>
                <input value={profile.name} readOnly aria-readonly="true" />
                <small>Managed through the existing organization record.</small>
              </label>
              <label>
                <span>Public address</span>
                <div className="profile-handle">
                  <span>/companies/</span>
                  <input value={profile.slug} readOnly aria-readonly="true" />
                </div>
                <small>
                  This stable organization address is reserved against
                  application routes.
                </small>
              </label>
              <label>
                <span>Logo URL</span>
                <input
                  name="logoUrl"
                  defaultValue={profile.logoUrl}
                  inputMode="url"
                  placeholder="https://"
                />
                <small>
                  Optional secure image address. Uploads are not enabled here.
                </small>
                <FieldError state={saveState} name="logoUrl" />
              </label>
              <label>
                <span>Website URL</span>
                <input
                  name="websiteUrl"
                  defaultValue={profile.websiteUrl}
                  inputMode="url"
                  placeholder="https://"
                />
                <FieldError state={saveState} name="websiteUrl" />
              </label>
              <label>
                <span>Industry</span>
                <input
                  name="industry"
                  defaultValue={profile.industry}
                  maxLength={100}
                  placeholder="Developer tools"
                />
              </label>
              <label>
                <span>Company size</span>
                <input
                  name="companySize"
                  defaultValue={profile.companySize}
                  maxLength={80}
                  placeholder="Small product team"
                />
              </label>
              <label>
                <span>Founded year</span>
                <input
                  name="foundedYear"
                  defaultValue={profile.foundedYear}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="2024"
                />
                <FieldError state={saveState} name="foundedYear" />
              </label>
            </div>
            <label>
              <span>Short description</span>
              <textarea
                name="shortDescription"
                defaultValue={profile.shortDescription}
                rows={3}
                maxLength={280}
                placeholder="Describe the company’s work in plain language."
              />
              <FieldError state={saveState} name="shortDescription" />
            </label>
          </section>

          <section
            className="profile-section"
            id="work"
            aria-labelledby="company-work-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">02 / work context</p>
              <h2 id="company-work-title">
                Make the work understandable before any opportunity exists
              </h2>
              <p>
                Describe current technical and collaboration context. These
                fields are not evidence of organizational verification or a
                promise of available work.
              </p>
            </div>
            <label>
              <span>What the company builds</span>
              <textarea
                name="whatWeBuild"
                defaultValue={profile.whatWeBuild}
                rows={5}
                maxLength={1200}
                placeholder="Explain the product, users, or technical problem context."
              />
              <FieldError state={saveState} name="whatWeBuild" />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>Engineering practices</span>
                <input
                  name="engineeringPractices"
                  defaultValue={profile.engineeringPractices.join(", ")}
                  maxLength={600}
                  placeholder="Code review, written decisions"
                />
                <small>Short comma-separated context labels.</small>
              </label>
              <label>
                <span>Technology areas</span>
                <input
                  name="technologyAreas"
                  defaultValue={profile.technologyAreas.join(", ")}
                  maxLength={600}
                  placeholder="Next.js, PostgreSQL"
                />
              </label>
              <label>
                <span>Collaboration style</span>
                <input
                  name="collaborationStyle"
                  defaultValue={profile.collaborationStyle}
                  maxLength={240}
                  placeholder="Async documentation with scheduled pairing"
                />
              </label>
              <label>
                <span>Timezone overlap</span>
                <input
                  name="timezoneOverlap"
                  defaultValue={profile.timezoneOverlap}
                  maxLength={160}
                  placeholder="Four hours with UTC+06"
                />
              </label>
              <label>
                <span>Work location preference</span>
                <input
                  name="workLocationPreference"
                  defaultValue={profile.workLocationPreference}
                  maxLength={120}
                  placeholder="Remote-first"
                />
              </label>
              <label>
                <span>Typical project types</span>
                <input
                  name="typicalProjectTypes"
                  defaultValue={profile.typicalProjectTypes.join(", ")}
                  maxLength={600}
                  placeholder="Product UI, platform reliability"
                />
              </label>
            </div>
          </section>

          <section
            className="profile-section"
            id="hiring"
            aria-labelledby="company-hiring-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">03 / hiring context</p>
              <h2 id="company-hiring-title">
                Share decision context, not an open role or application workflow
              </h2>
              <p>
                Proofly does not create projects, applications, messaging, paid
                trials, billing, or hiring decisions in this phase.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Hiring focus</span>
                <input
                  name="hiringFocus"
                  defaultValue={profile.hiringFocus}
                  maxLength={240}
                  placeholder="Early-career frontend product work"
                />
                <FieldError state={saveState} name="hiringFocus" />
              </label>
              <label>
                <span>Engagement types</span>
                <input
                  name="engagementTypes"
                  defaultValue={profile.engagementTypes.join(", ")}
                  maxLength={600}
                  placeholder="Paid trial, contract"
                />
              </label>
              <label>
                <span>Response expectations</span>
                <input
                  name="responseExpectations"
                  defaultValue={profile.responseExpectations}
                  maxLength={240}
                  placeholder="Context may be reviewed when a future opportunity is available"
                />
              </label>
              <label className="profile-checkbox">
                <input
                  name="activeOpportunities"
                  type="checkbox"
                  defaultChecked={profile.activeOpportunities}
                />
                <span>
                  <strong>Open to future opportunities</strong>
                  <small>
                    This is context only. It does not publish a role, accept
                    applications, or promise a response.
                  </small>
                </span>
              </label>
            </div>
            <label>
              <span>Review and paid-trial philosophy</span>
              <textarea
                name="reviewTrialPhilosophy"
                defaultValue={profile.reviewTrialPhilosophy}
                rows={4}
                maxLength={600}
                placeholder="Describe principles for fair evaluation. Do not publish payment terms or make a commitment here."
              />
            </label>
          </section>

          <section
            className="profile-section"
            id="attribution"
            aria-labelledby="company-attribution-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">04 / member attribution</p>
              <h2 id="company-attribution-title">
                Choose your own public attribution
              </h2>
              <p>
                Your name appears only if your personal account setting permits
                public company attribution and you select this profile-level
                opt-in.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Your public role label</span>
                <input
                  name="memberRoleLabel"
                  defaultValue={attribution.roleLabel}
                  maxLength={80}
                  placeholder="Engineering lead"
                />
              </label>
              <label className="profile-checkbox">
                <input
                  name="showMyAttribution"
                  type="checkbox"
                  defaultChecked={attribution.isPublic}
                />
                <span>
                  <strong>Show my name with this company</strong>
                  <small>
                    Public display still respects your separate account privacy
                    setting.
                  </small>
                </span>
              </label>
            </div>
          </section>
          <div className="profile-save-bar">
            <div>
              <strong>Private organization draft</strong>
              <p>
                Saving never publishes company context or changes organization
                ownership.
              </p>
            </div>
            <div>
              <button className="button button-primary" type="submit">
                Save private draft
              </button>
              <button className="button button-secondary" type="reset">
                Reset unsaved fields
              </button>
            </div>
          </div>
          <Status state={saveState} />
        </form>

        <aside className="profile-aside">
          <section
            className="profile-checklist"
            aria-labelledby="company-checklist-title"
          >
            <p className="profile-kicker">Completion guidance</p>
            <h2 id="company-checklist-title">Prepare a clear public context</h2>
            <ul>
              <li data-complete={profile.shortDescription.length >= 8}>
                <span aria-hidden="true">
                  {profile.shortDescription.length >= 8 ? "✓" : "○"}
                </span>
                Clear company description
              </li>
              <li data-complete={profile.whatWeBuild.length >= 8}>
                <span aria-hidden="true">
                  {profile.whatWeBuild.length >= 8 ? "✓" : "○"}
                </span>
                Useful work context
              </li>
              <li data-complete={profile.hiringFocus.length >= 3}>
                <span aria-hidden="true">
                  {profile.hiringFocus.length >= 3 ? "✓" : "○"}
                </span>
                Human-readable hiring context
              </li>
              <li
                data-complete={
                  profile.draftState === "ready_to_preview" ||
                  publication?.state === "published"
                }
              >
                <span aria-hidden="true">
                  {profile.draftState === "ready_to_preview" ||
                  publication?.state === "published"
                    ? "✓"
                    : "○"}
                </span>
                Public field review
              </li>
            </ul>
          </section>
          <section
            className="profile-lifecycle"
            id="preview"
            aria-labelledby="company-lifecycle-title"
          >
            <p className="profile-kicker">Visibility and lifecycle</p>
            <h2 id="company-lifecycle-title">Preview, publish, or hide</h2>
            <p>
              Public pages resolve only from an approved snapshot. Hidden pages
              no longer resolve, while authorized members retain the private
              draft.
            </p>
            <dl>
              <div>
                <dt>Draft</dt>
                <dd>Private to authorized members.</dd>
              </div>
              <div>
                <dt>Ready to preview</dt>
                <dd>Owner review before publishing.</dd>
              </div>
              <div>
                <dt>Published</dt>
                <dd>Public company context at the stable address.</dd>
              </div>
              <div>
                <dt>Hidden</dt>
                <dd>Public address no longer resolves.</dd>
              </div>
            </dl>
            {attribution.canPublish ? (
              <>
                <form action={previewAction}>
                  <button className="button button-secondary" type="submit">
                    Mark ready to preview
                  </button>
                  <Status state={previewState} />
                </form>
                {publication?.state === "published" ? (
                  <form action={hideAction}>
                    <button className="button button-danger" type="submit">
                      Hide public company page
                    </button>
                    <Status state={hideState} />
                  </form>
                ) : (
                  <form action={publishAction}>
                    <label className="profile-checkbox">
                      <input
                        type="checkbox"
                        name="confirmPublicCompanyProfile"
                        value="confirmed"
                        checked={publishConfirmed}
                        onChange={event =>
                          setPublishConfirmed(event.target.checked)
                        }
                      />
                      <span>
                        <strong>I reviewed the public company fields</strong>
                        <small>
                          Private members, contact details, and future workflow
                          controls are not included.
                        </small>
                      </span>
                    </label>
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={
                        !publishConfirmed ||
                        profile.draftState !== "ready_to_preview"
                      }
                    >
                      Publish approved context
                    </button>
                    <Status state={publishState} />
                  </form>
                )}
              </>
            ) : (
              <p className="profile-proof-boundary">
                <strong>Publication authority:</strong> an organization owner
                must review, publish, or hide this company page.
              </p>
            )}
            {publication?.state === "published" ? (
              <a
                className="profile-public-link"
                href={`/companies/${publication.slug}`}
              >
                Open public company page <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </section>
          <PrivatePreview context={context} />
        </aside>
      </div>
    </AuthShell>
  );
}
