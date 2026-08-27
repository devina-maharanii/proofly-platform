"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  hideTalentProfileAction,
  prepareTalentProfilePreviewAction,
  publishTalentProfileAction,
  saveTalentProfileAction,
} from "@/lib/profile/actions";
import {
  canonicalSkillFamilies,
  canonicalSkillLabel,
  initialProfileActionState,
  type ProfileActionState,
  type TalentProfileContext,
  type TalentProfileLink,
  type TalentProfileSkill,
} from "@/lib/profile/types";

function Status({ state }: Readonly<{ state: ProfileActionState }>) {
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
}: Readonly<{ state: ProfileActionState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="profile-field-error">{message}</p> : null;
}

function CompletionChecklist({
  context,
}: Readonly<{ context: TalentProfileContext }>) {
  const { profile, publication } = context;
  const items = [
    {
      label: "Name and a public address",
      complete: profile.displayName.length >= 2 && profile.handle.length >= 3,
    },
    {
      label: "A clear developer focus",
      complete: profile.developerFocus.length >= 2,
    },
    {
      label: "A headline that explains direction",
      complete: profile.headline.length >= 3,
    },
    {
      label: "At least one claimed canonical skill",
      complete: profile.skills.length > 0,
    },
    {
      label: "A published field review",
      complete:
        profile.draftState === "ready_to_preview" ||
        publication?.state === "published",
    },
  ];
  return (
    <section
      className="profile-checklist"
      aria-labelledby="profile-checklist-title"
    >
      <p className="profile-kicker">Completion guidance</p>
      <h2 id="profile-checklist-title">Make the next choice clear</h2>
      <p>
        This is a preparation checklist, not a quality score or a measure of
        your ability.
      </p>
      <ul>
        {items.map(item => (
          <li key={item.label} data-complete={item.complete}>
            <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrivatePreview({
  context,
}: Readonly<{ context: TalentProfileContext }>) {
  const { profile } = context;
  return (
    <section
      className="profile-preview"
      aria-labelledby="profile-preview-title"
    >
      <div className="profile-preview-heading">
        <div>
          <p className="profile-kicker">Private preview</p>
          <h2 id="profile-preview-title">How your profile reads</h2>
        </div>
        <span className="profile-state-badge">
          {profile.draftState.replaceAll("_", " ")}
        </span>
      </div>
      <div className="profile-preview-surface">
        <p className="profile-preview-name">
          {profile.displayName || "Your display name"}
        </p>
        <p className="profile-preview-headline">
          {profile.headline || "A clear, specific headline belongs here."}
        </p>
        {profile.introduction ? (
          <p>{profile.introduction}</p>
        ) : (
          <p className="profile-empty-copy">
            Add a short introduction when it helps someone understand your
            direction.
          </p>
        )}
        <dl className="profile-preview-meta">
          <div>
            <dt>Focus</dt>
            <dd>{profile.developerFocus || "Not added"}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{profile.currentExperienceLevel || "Not added"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {profile.locationVisibility === "public"
                ? profile.locationName || "Not added"
                : "Private"}
            </dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>
              {profile.timezoneVisibility === "public"
                ? profile.timezone
                : "Private"}
            </dd>
          </div>
        </dl>
        <div className="profile-preview-skills">
          <p>Claimed skills</p>
          {profile.skills.length ? (
            <ul>
              {profile.skills.map(skill => (
                <li key={skill.skillKey}>
                  <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                  <span>Claimed · {skill.claimedLevel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              No claimed skills yet. Choose from the canonical software
              taxonomy.
            </p>
          )}
        </div>
        <p className="profile-proof-boundary">
          <strong>Verified proof:</strong> No verified proof yet. A claim is not
          a review or a proof record.
        </p>
      </div>
    </section>
  );
}

export function TalentProfileEditor({
  context,
}: Readonly<{ context: TalentProfileContext }>) {
  const { profile, publication, activeTalentContext } = context;
  const [saveState, saveAction] = useActionState(
    saveTalentProfileAction,
    initialProfileActionState
  );
  const [previewState, previewAction] = useActionState(
    prepareTalentProfilePreviewAction,
    initialProfileActionState
  );
  const [publishState, publishAction] = useActionState(
    publishTalentProfileAction,
    initialProfileActionState
  );
  const [hideState, hideAction] = useActionState(
    hideTalentProfileAction,
    initialProfileActionState
  );
  const [skills, setSkills] = useState<TalentProfileSkill[]>(profile.skills);
  const [links, setLinks] = useState<TalentProfileLink[]>(profile.links);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const availableSkills = useMemo(
    () =>
      canonicalSkillFamilies
        .flatMap(family =>
          family.skills.map(([key, label]) => ({
            key,
            label,
            family: family.label,
          }))
        )
        .filter(skill => !skills.some(item => item.skillKey === skill.key)),
    [skills]
  );

  if (!activeTalentContext) {
    return (
      <AuthShell
        eyebrow="Talent profile"
        title="Switch to Talent to edit your profile"
        description="Talent profiles are private owner records. Select your Talent context before creating or changing this profile."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose a context
        </Link>
      </AuthShell>
    );
  }

  const addSkill = () => {
    if (!selectedSkill || skills.length >= 12) return;
    setSkills(current => [
      ...current,
      {
        skillKey: selectedSkill as TalentProfileSkill["skillKey"],
        claimedLevel: "working",
        context: "",
      },
    ]);
    setSelectedSkill("");
  };

  const updateSkill = (index: number, next: Partial<TalentProfileSkill>) =>
    setSkills(current =>
      current.map((skill, candidate) =>
        candidate === index ? { ...skill, ...next } : skill
      )
    );
  const updateLink = (index: number, next: Partial<TalentProfileLink>) =>
    setLinks(current =>
      current.map((link, candidate) =>
        candidate === index ? { ...link, ...next } : link
      )
    );

  return (
    <AuthShell
      eyebrow="Talent profile"
      title="Explain your direction, then choose what is public"
      description="Keep a private draft while you prepare. Claimed skills remain distinct from review-backed proof, and contact details are never public by default."
    >
      <nav className="profile-nav" aria-label="Talent profile sections">
        <a href="#identity">Identity</a>
        <a href="#direction">Direction</a>
        <a href="#skills">Skills</a>
        <a href="#preferences">Preferences</a>
        <a href="#links">Links</a>
        <a href="#preview">Preview</a>
        <Link href={"/profile/evidence" as Route}>Work evidence</Link>
        <Link href={"/proof" as Route}>Proof audit</Link>
      </nav>
      <div className="profile-layout">
        <form action={saveAction} className="profile-editor-form">
          <input type="hidden" name="skills" value={JSON.stringify(skills)} />
          <input type="hidden" name="links" value={JSON.stringify(links)} />
          <section
            className="profile-section"
            id="identity"
            aria-labelledby="identity-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">01 / identity</p>
              <h2 id="identity-title">
                Say who you are without exposing more than you choose
              </h2>
              <p>
                Your contact information stays private. Each optional public
                field names its visibility here.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Display name</span>
                <input
                  name="displayName"
                  defaultValue={profile.displayName}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
                <FieldError state={saveState} name="displayName" />
              </label>
              <label>
                <span>Public address</span>
                <div className="profile-handle">
                  <span>/p/</span>
                  <input
                    name="handle"
                    defaultValue={profile.handle}
                    maxLength={40}
                    autoCapitalize="none"
                    autoComplete="off"
                    placeholder="your-name"
                    required
                  />
                </div>
                <small>
                  Lowercase letters, numbers, and hyphens. This is the address
                  you can publish.
                </small>
                <FieldError state={saveState} name="handle" />
              </label>
              <label>
                <span>Profile image URL</span>
                <input
                  name="profileImageUrl"
                  defaultValue={profile.profileImageUrl}
                  inputMode="url"
                  placeholder="https://"
                />
                <small>
                  Optional HTTPS image address. Uploads are not enabled here.
                </small>
                <FieldError state={saveState} name="profileImageUrl" />
              </label>
              <label>
                <span>Profile image visibility</span>
                <select
                  name="profileImageVisibility"
                  defaultValue={profile.profileImageVisibility}
                >
                  <option value="private">Private</option>
                  <option value="public">Public on profile</option>
                </select>
                <small>
                  Private images are not included in the public profile.
                </small>
              </label>
              <label>
                <span>Headline</span>
                <input
                  name="headline"
                  defaultValue={profile.headline}
                  maxLength={140}
                  placeholder="Early-career frontend developer focused on accessible product UI"
                  required
                />
                <FieldError state={saveState} name="headline" />
              </label>
              <label>
                <span>Timezone</span>
                <input
                  name="timezone"
                  defaultValue={profile.timezone}
                  maxLength={80}
                  placeholder="UTC+06:00"
                  required
                />
                <FieldError state={saveState} name="timezone" />
              </label>
              <label>
                <span>Timezone visibility</span>
                <select
                  name="timezoneVisibility"
                  defaultValue={profile.timezoneVisibility}
                >
                  <option value="private">Private</option>
                  <option value="public">Public on profile</option>
                </select>
              </label>
              <label>
                <span>Location</span>
                <input
                  name="locationName"
                  defaultValue={profile.locationName}
                  maxLength={120}
                  placeholder="Dhaka, Bangladesh"
                />
                <FieldError state={saveState} name="locationName" />
              </label>
              <label>
                <span>Location visibility</span>
                <select
                  name="locationVisibility"
                  defaultValue={profile.locationVisibility}
                >
                  <option value="private">Private</option>
                  <option value="public">Public on profile</option>
                </select>
              </label>
              <label>
                <span>Languages</span>
                <input
                  name="languages"
                  defaultValue={profile.languages.join(", ")}
                  maxLength={600}
                  placeholder="English, Bangla"
                />
                <small>
                  Use a short comma-separated list of languages you choose to
                  describe. Languages stay private in this phase.
                </small>
                <FieldError state={saveState} name="languages" />
              </label>
            </div>
            <label>
              <span>Short introduction</span>
              <textarea
                name="introduction"
                defaultValue={profile.introduction}
                maxLength={1200}
                rows={5}
                placeholder="Describe the work you want to make understandable. Avoid adding private contact details."
              />
              <FieldError state={saveState} name="introduction" />
            </label>
          </section>
          <section
            className="profile-section"
            id="direction"
            aria-labelledby="direction-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">02 / professional direction</p>
              <h2 id="direction-title">Give work a useful context</h2>
              <p>
                These descriptions support human understanding. They do not rank
                you or make an opportunity decision.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Developer focus</span>
                <input
                  name="developerFocus"
                  defaultValue={profile.developerFocus}
                  maxLength={160}
                  placeholder="Frontend systems and accessible interfaces"
                  required
                />
                <FieldError state={saveState} name="developerFocus" />
              </label>
              <label>
                <span>Current experience level</span>
                <select
                  name="currentExperienceLevel"
                  defaultValue={profile.currentExperienceLevel}
                >
                  <option value="">Choose a description</option>
                  <option value="Early-career">Early-career</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid-level">Mid-level</option>
                  <option value="Senior">Senior</option>
                </select>
              </label>
              <label>
                <span>Preferred project types</span>
                <input
                  name="preferredProjectTypes"
                  defaultValue={profile.preferredProjectTypes.join(", ")}
                  maxLength={600}
                  placeholder="Product UI, frontend maintenance"
                />
                <small>
                  Use a short comma-separated list. Keep it specific to the work
                  you seek.
                </small>
                <FieldError state={saveState} name="preferredProjectTypes" />
              </label>
              <label>
                <span>Target opportunity type</span>
                <select
                  name="targetOpportunityType"
                  defaultValue={profile.targetOpportunityType}
                >
                  <option value="">Choose an option</option>
                  <option value="Paid trial">Paid trial</option>
                  <option value="Contract">Contract</option>
                  <option value="Part-time role">Part-time role</option>
                  <option value="Full-time role">Full-time role</option>
                </select>
              </label>
            </div>
          </section>
          <section
            className="profile-section"
            id="skills"
            aria-labelledby="skills-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">03 / claimed skills</p>
              <h2 id="skills-title">Use the governed software taxonomy</h2>
              <p>
                Each entry is your claim with context. Claims are not shown as
                verified proof and no score is calculated.
              </p>
            </div>
            <div className="profile-add-row">
              <label>
                <span>Add canonical skill</span>
                <select
                  value={selectedSkill}
                  onChange={event => setSelectedSkill(event.target.value)}
                >
                  <option value="">Choose a skill</option>
                  {availableSkills.map(skill => (
                    <option key={skill.key} value={skill.key}>
                      {skill.family} — {skill.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button button-secondary"
                onClick={addSkill}
                disabled={!selectedSkill || skills.length >= 12}
              >
                Add skill
              </button>
            </div>
            {skills.length ? (
              <div className="profile-skill-list">
                {skills.map((skill, index) => (
                  <fieldset key={skill.skillKey} className="profile-skill-row">
                    <legend>{canonicalSkillLabel(skill.skillKey)}</legend>
                    <label>
                      <span>Claimed level</span>
                      <select
                        value={skill.claimedLevel}
                        onChange={event =>
                          updateSkill(index, {
                            claimedLevel: event.target
                              .value as TalentProfileSkill["claimedLevel"],
                          })
                        }
                      >
                        {[
                          "familiar",
                          "working",
                          "independent",
                          "advanced",
                          "reviewer",
                        ].map(level => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Context</span>
                      <input
                        value={skill.context}
                        maxLength={360}
                        onChange={event =>
                          updateSkill(index, { context: event.target.value })
                        }
                        placeholder="What work or task gives this claim context?"
                      />
                    </label>
                    <button
                      type="button"
                      className="profile-remove"
                      onClick={() =>
                        setSkills(current =>
                          current.filter((_, candidate) => candidate !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                    <p>
                      <strong>Claimed, not verified.</strong> Evidence and
                      review will be connected only in their approved phases.
                    </p>
                  </fieldset>
                ))}
              </div>
            ) : (
              <div className="profile-empty-state">
                <strong>No skills selected yet.</strong>
                <p>
                  Choose a governed skill when it helps someone understand the
                  direction of your work.
                </p>
              </div>
            )}
            <FieldError state={saveState} name="skills" />
          </section>
          <section
            className="profile-section"
            id="preferences"
            aria-labelledby="preferences-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">04 / work preferences</p>
              <h2 id="preferences-title">Describe the conditions you prefer</h2>
              <p>
                Rate ranges remain private in this phase. This information is a
                preference, not an offer or payment commitment.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Availability window</span>
                <input
                  name="availabilityWindow"
                  defaultValue={profile.availabilityWindow}
                  maxLength={120}
                  placeholder="Available from July, 20 hours/week"
                />
              </label>
              <label>
                <span>Engagement preference</span>
                <input
                  name="engagementPreference"
                  defaultValue={profile.engagementPreference}
                  maxLength={120}
                  placeholder="Remote contract"
                />
              </label>
              <label>
                <span>
                  Rate range <small>Private</small>
                </span>
                <input
                  name="rateRange"
                  defaultValue={profile.rateRange}
                  maxLength={80}
                  placeholder="Share later if relevant"
                />
              </label>
              <label>
                <span>Timezone overlap preference</span>
                <input
                  name="timezoneOverlapPreference"
                  defaultValue={profile.timezoneOverlapPreference}
                  maxLength={120}
                  placeholder="4 hours with Europe"
                />
              </label>
              <label>
                <span>Remote collaboration preference</span>
                <input
                  name="remoteCollaborationPreference"
                  defaultValue={profile.remoteCollaborationPreference}
                  maxLength={120}
                  placeholder="Async-friendly, documented handoffs"
                />
              </label>
            </div>
          </section>
          <section
            className="profile-section"
            id="links"
            aria-labelledby="links-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">05 / links</p>
              <h2 id="links-title">Link only what you choose</h2>
              <p>
                Portfolio links are private until you explicitly mark each one
                public. Optional GitHub context is selected and managed from
                Connected accounts, separately from these profile links.
              </p>
            </div>
            <div className="profile-github-surface">
              <strong>GitHub connection</strong>
              <span>
                Import only public repository context after explicit consent.
                GitHub activity remains unverified context, not proof of skill.
              </span>
              <a href="/settings#connections">Manage GitHub context →</a>
            </div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                setLinks(current =>
                  current.length >= 5
                    ? current
                    : [
                        ...current,
                        {
                          linkType: "portfolio",
                          label: "",
                          url: "",
                          isPublic: false,
                        },
                      ]
                )
              }
              disabled={links.length >= 5}
            >
              Add a link
            </button>
            {links.map((link, index) => (
              <fieldset
                className="profile-link-row"
                key={`${link.url}-${index}`}
              >
                <legend>Link {index + 1}</legend>
                <label>
                  <span>Type</span>
                  <select
                    value={link.linkType}
                    onChange={event =>
                      updateLink(index, {
                        linkType: event.target
                          .value as TalentProfileLink["linkType"],
                      })
                    }
                  >
                    <option value="portfolio">Portfolio</option>
                    <option value="website">Personal website</option>
                  </select>
                </label>
                <label>
                  <span>Label</span>
                  <input
                    value={link.label}
                    maxLength={80}
                    onChange={event =>
                      updateLink(index, { label: event.target.value })
                    }
                    placeholder="Optional label"
                  />
                </label>
                <label>
                  <span>HTTPS URL</span>
                  <input
                    value={link.url}
                    inputMode="url"
                    onChange={event =>
                      updateLink(index, { url: event.target.value })
                    }
                    placeholder="https://"
                  />
                </label>
                <label className="profile-checkbox">
                  <input
                    type="checkbox"
                    checked={link.isPublic}
                    onChange={event =>
                      updateLink(index, { isPublic: event.target.checked })
                    }
                  />
                  <span>
                    <strong>Show publicly</strong>
                    <small>Private unless selected.</small>
                  </span>
                </label>
                <button
                  type="button"
                  className="profile-remove"
                  onClick={() =>
                    setLinks(current =>
                      current.filter((_, candidate) => candidate !== index)
                    )
                  }
                >
                  Remove
                </button>
              </fieldset>
            ))}
            <FieldError state={saveState} name="links" />
          </section>
          <div className="profile-save-bar">
            <div>
              <strong>Private draft</strong>
              <p>Saving does not publish this profile.</p>
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
          <CompletionChecklist context={context} />
          <section
            className="profile-lifecycle"
            id="preview"
            aria-labelledby="profile-lifecycle-title"
          >
            <p className="profile-kicker">Visibility and lifecycle</p>
            <h2 id="profile-lifecycle-title">Preview, publish, or hide</h2>
            <p>
              Only fields marked public are copied into the public profile
              snapshot.
            </p>
            <dl>
              <div>
                <dt>Draft</dt>
                <dd>Private to you.</dd>
              </div>
              <div>
                <dt>Ready to preview</dt>
                <dd>Private review state; publishing is still separate.</dd>
              </div>
              <div>
                <dt>Published</dt>
                <dd>Approved public fields available at your address.</dd>
              </div>
              <div>
                <dt>Hidden</dt>
                <dd>
                  Public address no longer resolves; private draft remains.
                </dd>
              </div>
            </dl>
            <form action={previewAction}>
              <button className="button button-secondary" type="submit">
                Mark ready to preview
              </button>
              <Status state={previewState} />
            </form>
            {publication?.state === "published" ? (
              <form action={hideAction}>
                <button className="button button-danger" type="submit">
                  Hide public profile
                </button>
                <Status state={hideState} />
              </form>
            ) : (
              <form action={publishAction}>
                <label className="profile-checkbox">
                  <input
                    type="checkbox"
                    name="confirmPublicProfile"
                    value="confirmed"
                    checked={publishConfirmed}
                    onChange={event =>
                      setPublishConfirmed(event.target.checked)
                    }
                  />
                  <span>
                    <strong>I reviewed the public fields</strong>
                    <small>
                      Private contact details and private links are not
                      included.
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
                  Publish approved fields
                </button>
                <Status state={publishState} />
              </form>
            )}
            {publication?.state === "published" ? (
              <a
                href={`/talent/${publication.handle}`}
                className="profile-public-link"
              >
                Open public profile <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </section>
          <PrivatePreview context={context} />
        </aside>
      </div>
    </AuthShell>
  );
}
