"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useActionState, useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  archiveWorkEvidenceAction,
  hideWorkEvidenceAction,
  prepareWorkEvidencePreviewAction,
  publishWorkEvidenceAction,
  saveWorkEvidenceAction,
} from "@/lib/evidence/actions";
import {
  initialWorkEvidenceActionState,
  workEvidenceLinkAvailabilities,
  workEvidenceLinkTypes,
  workEvidenceOwnershipStatuses,
  workEvidenceStateLabel,
  workEvidenceTypeLabel,
  workEvidenceTypes,
  type WorkEvidenceActionState,
  type WorkEvidenceAttribution,
  type WorkEvidenceEditorContext,
  type WorkEvidenceLink,
  type WorkEvidenceSkill,
} from "@/lib/evidence/types";
import {
  canonicalSkillFamilies,
  canonicalSkillLabel,
} from "@/lib/profile/types";

function Status({ state }: Readonly<{ state: WorkEvidenceActionState }>) {
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
}: Readonly<{ state: WorkEvidenceActionState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="profile-field-error">{message}</p> : null;
}

function EvidencePreview({
  context,
}: Readonly<{ context: WorkEvidenceEditorContext }>) {
  const { evidence, publication } = context;
  return (
    <section
      className="profile-preview"
      aria-labelledby="evidence-preview-title"
    >
      <div className="profile-preview-heading">
        <div>
          <p className="profile-kicker">Private preview</p>
          <h2 id="evidence-preview-title">A readable work record</h2>
        </div>
        <span className="profile-state-badge">
          {workEvidenceStateLabel(evidence.state)}
        </span>
      </div>
      <div className="profile-preview-surface evidence-preview-surface">
        <p className="profile-preview-name">{evidence.title || "Work title"}</p>
        <p className="profile-preview-headline">
          {evidence.shortSummary ||
            "A concise summary makes the work scannable."}
        </p>
        <dl className="profile-preview-meta">
          <div>
            <dt>Context</dt>
            <dd>{workEvidenceTypeLabel(evidence.evidenceType)}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd>{evidence.userRole || "Not added"}</dd>
          </div>
          <div>
            <dt>Ownership</dt>
            <dd>{evidence.ownershipStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>v{evidence.version}</dd>
          </div>
        </dl>
        <div className="profile-preview-skills">
          <p>Canonical skills in context</p>
          {evidence.skills.length ? (
            <ul>
              {evidence.skills.map(skill => (
                <li key={skill.skillKey}>
                  <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                  <span>{skill.context || "Context not added"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-empty-copy">
              Choose only skills that the work can contextually support.
            </p>
          )}
        </div>
        <p className="profile-proof-boundary">
          <strong>Verification:</strong> This is manual work evidence, not
          verified proof. It will remain clearly labeled until a later approved
          human-review workflow exists.
        </p>
        {publication?.state === "published" ? (
          <a
            className="profile-public-link"
            href={`/evidence/${publication.publicId}`}
          >
            View published evidence ↗
          </a>
        ) : null}
      </div>
    </section>
  );
}

function CompletionChecklist({
  context,
}: Readonly<{ context: WorkEvidenceEditorContext }>) {
  const evidence = context.evidence;
  const complete = [
    {
      label: "Clear title and concise summary",
      value: evidence.title.length >= 3 && evidence.shortSummary.length >= 10,
    },
    {
      label: "Problem, role, contribution, and scope",
      value:
        evidence.problemGoal.length >= 10 &&
        evidence.userRole.length >= 2 &&
        evidence.personalContribution.length >= 10 &&
        evidence.contributionScope.length >= 3,
    },
    {
      label: "At least one canonical skill in context",
      value: evidence.skills.length > 0,
    },
    {
      label: "Team attribution when collaboration applies",
      value: !evidence.teamWork || evidence.attributions.length > 0,
    },
    { label: "Private preview completed", value: evidence.state !== "draft" },
  ];
  return (
    <section
      className="profile-checklist"
      aria-labelledby="evidence-checklist-title"
    >
      <p className="profile-kicker">Completion guidance</p>
      <h2 id="evidence-checklist-title">Make the work understandable</h2>
      <p>
        This checklist explains what makes an evidence record useful. It is not
        a quality score, reputation measure, or verification decision.
      </p>
      <ul>
        {complete.map(item => (
          <li key={item.label} data-complete={item.value}>
            <span aria-hidden="true">{item.value ? "✓" : "○"}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TalentEvidenceEditor({
  context,
}: Readonly<{ context: WorkEvidenceEditorContext }>) {
  const router = useRouter();
  const { evidence, publication, activeTalentContext } = context;
  const [saveState, saveAction] = useActionState(
    saveWorkEvidenceAction,
    initialWorkEvidenceActionState
  );
  const [previewState, previewAction] = useActionState(
    prepareWorkEvidencePreviewAction,
    initialWorkEvidenceActionState
  );
  const [publishState, publishAction] = useActionState(
    publishWorkEvidenceAction,
    initialWorkEvidenceActionState
  );
  const [hideState, hideAction] = useActionState(
    hideWorkEvidenceAction,
    initialWorkEvidenceActionState
  );
  const [archiveState, archiveAction] = useActionState(
    archiveWorkEvidenceAction,
    initialWorkEvidenceActionState
  );
  const [skills, setSkills] = useState<WorkEvidenceSkill[]>(evidence.skills);
  const [links, setLinks] = useState<WorkEvidenceLink[]>(evidence.links);
  const [attributions, setAttributions] = useState<WorkEvidenceAttribution[]>(
    evidence.attributions
  );
  const [selectedSkill, setSelectedSkill] = useState("");
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  useEffect(() => {
    if (
      !evidence.id &&
      saveState.status === "success" &&
      saveState.evidenceId
    ) {
      window.location.replace(`/profile/evidence/${saveState.evidenceId}`);
    }
  }, [evidence.id, router, saveState.evidenceId, saveState.status]);

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
        eyebrow="Work evidence"
        title="Switch to Talent to manage work evidence"
        description="Work evidence is an owner-controlled Talent record. Select your Talent context before creating or changing it."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose a context
        </Link>
      </AuthShell>
    );
  }

  const isArchived = evidence.state === "archived";
  return (
    <AuthShell
      eyebrow="Portfolio and work evidence"
      title={
        evidence.id ? "Edit your work record" : "Add structured work evidence"
      }
      description="Describe real work with context, your contribution, ownership boundaries, and selected visibility. Proofly does not verify this work in this phase."
    >
      <nav className="profile-nav" aria-label="Talent profile navigation">
        <Link href="/profile">Profile</Link>
        <Link href={"/profile/evidence" as Route}>Work evidence</Link>
        <Link
          href={"/profile/evidence/new" as Route}
          aria-current={!evidence.id ? "page" : undefined}
        >
          Add evidence
        </Link>
      </nav>
      <div className="profile-layout evidence-layout">
        <form
          action={saveAction}
          className="profile-editor-form evidence-editor-form"
        >
          <input type="hidden" name="evidenceId" value={evidence.id} />
          <input type="hidden" name="skills" value={JSON.stringify(skills)} />
          <input type="hidden" name="links" value={JSON.stringify(links)} />
          <input
            type="hidden"
            name="attributions"
            value={JSON.stringify(attributions)}
          />
          <fieldset disabled={isArchived} className="evidence-fieldset">
            <section className="profile-section">
              <div className="profile-section-heading">
                <p className="profile-index">01 · Context</p>
                <h2>Describe the work without overstating it</h2>
                <p>
                  Use short, concrete prompts. A draft can be incomplete;
                  publication cannot conceal ownership or collaboration
                  boundaries.
                </p>
              </div>
              <div className="profile-form-grid">
                <label>
                  <span>Title</span>
                  <input
                    name="title"
                    defaultValue={evidence.title}
                    maxLength={120}
                    autoComplete="off"
                  />
                  <FieldError state={saveState} name="title" />
                </label>
                <label>
                  <span>Evidence type</span>
                  <select
                    name="evidenceType"
                    defaultValue={evidence.evidenceType}
                  >
                    {workEvidenceTypes.map(type => (
                      <option key={type} value={type}>
                        {workEvidenceTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>
                  Short summary{" "}
                  <small>What someone should understand first.</small>
                </span>
                <textarea
                  name="shortSummary"
                  defaultValue={evidence.shortSummary}
                  maxLength={360}
                />
                <FieldError state={saveState} name="shortSummary" />
              </label>
              <label>
                <span>Problem or goal</span>
                <textarea
                  name="problemGoal"
                  defaultValue={evidence.problemGoal}
                  maxLength={1200}
                />
                <FieldError state={saveState} name="problemGoal" />
              </label>
              <div className="profile-form-grid">
                <label>
                  <span>Your role</span>
                  <input
                    name="userRole"
                    defaultValue={evidence.userRole}
                    maxLength={120}
                    autoComplete="off"
                  />
                  <FieldError state={saveState} name="userRole" />
                </label>
                <label>
                  <span>Contribution scope</span>
                  <input
                    name="contributionScope"
                    defaultValue={evidence.contributionScope}
                    maxLength={700}
                    autoComplete="off"
                  />
                  <FieldError state={saveState} name="contributionScope" />
                </label>
              </div>
              <label>
                <span>What you personally contributed</span>
                <textarea
                  name="personalContribution"
                  defaultValue={evidence.personalContribution}
                  maxLength={1600}
                />
                <FieldError state={saveState} name="personalContribution" />
              </label>
            </section>

            <section className="profile-section">
              <div className="profile-section-heading">
                <p className="profile-index">02 · Decisions</p>
                <h2>Keep the case study specific</h2>
                <p>
                  State constraints, decisions, tradeoffs, and the current
                  outcome. The form does not write a story for you.
                </p>
              </div>
              <label>
                <span>Context and constraints</span>
                <textarea
                  name="contextConstraints"
                  defaultValue={evidence.contextConstraints}
                  maxLength={1200}
                />
              </label>
              <label>
                <span>Decisions and tradeoffs</span>
                <textarea
                  name="decisionsTradeoffs"
                  defaultValue={evidence.decisionsTradeoffs}
                  maxLength={1400}
                />
              </label>
              <label>
                <span>Outcome or current status</span>
                <textarea
                  name="outcomeStatus"
                  defaultValue={evidence.outcomeStatus}
                  maxLength={900}
                />
              </label>
              <div className="profile-form-grid">
                <label>
                  <span>
                    Start date <small>Optional.</small>
                  </span>
                  <input
                    name="startedOn"
                    type="date"
                    defaultValue={evidence.startedOn}
                  />
                </label>
                <label>
                  <span>
                    Duration <small>Optional, e.g. “Three weeks”.</small>
                  </span>
                  <input
                    name="durationText"
                    defaultValue={evidence.durationText}
                    maxLength={120}
                    autoComplete="off"
                  />
                </label>
              </div>
            </section>

            <section className="profile-section">
              <div className="profile-section-heading">
                <p className="profile-index">03 · Skills</p>
                <h2>Reference canonical skills in context</h2>
                <p>
                  These links use taxonomy version 1.0.0. They are contextual
                  evidence references, not a score or verified result.
                </p>
              </div>
              <div className="profile-add-row">
                <label>
                  <span>Add a canonical skill</span>
                  <select
                    value={selectedSkill}
                    onChange={event => setSelectedSkill(event.target.value)}
                  >
                    <option value="">Choose a skill</option>
                    {availableSkills.map(skill => (
                      <option key={skill.key} value={skill.key}>
                        {skill.family} · {skill.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={!selectedSkill || skills.length >= 12}
                  onClick={() => {
                    setSkills(current => [
                      ...current,
                      {
                        skillKey:
                          selectedSkill as WorkEvidenceSkill["skillKey"],
                        taxonomyVersion: "1.0.0",
                        context: "",
                      },
                    ]);
                    setSelectedSkill("");
                  }}
                >
                  Add skill
                </button>
              </div>
              <FieldError state={saveState} name="skills" />
              <div className="profile-skill-list">
                {skills.map(skill => (
                  <fieldset className="profile-skill-row" key={skill.skillKey}>
                    <legend>{canonicalSkillLabel(skill.skillKey)}</legend>
                    <label>
                      <span>Work context</span>
                      <input
                        value={skill.context}
                        maxLength={360}
                        onChange={event =>
                          setSkills(current =>
                            current.map(item =>
                              item.skillKey === skill.skillKey
                                ? { ...item, context: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <button
                      className="profile-remove"
                      type="button"
                      onClick={() =>
                        setSkills(current =>
                          current.filter(
                            item => item.skillKey !== skill.skillKey
                          )
                        )
                      }
                    >
                      Remove
                    </button>
                  </fieldset>
                ))}
              </div>
            </section>

            <section className="profile-section">
              <div className="profile-section-heading">
                <p className="profile-index">04 · Links</p>
                <h2>Separate live links from unavailable work</h2>
                <p>
                  Links are external references. Uploaded attachments, GitHub
                  sync, and private-file delivery are not part of this phase.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                disabled={links.length >= 8}
                onClick={() =>
                  setLinks(current => [
                    ...current,
                    {
                      linkType: "repository",
                      label: "",
                      url: "",
                      availability: "available",
                      isPublic: false,
                    },
                  ])
                }
              >
                Add reference
              </button>
              {links.map((link, index) => (
                <fieldset
                  className="profile-link-row evidence-link-row"
                  key={`${link.url}-${index}`}
                >
                  <legend>Reference {index + 1}</legend>
                  <label>
                    <span>Type</span>
                    <select
                      value={link.linkType}
                      onChange={event =>
                        setLinks(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  linkType: event.target
                                    .value as WorkEvidenceLink["linkType"],
                                }
                              : item
                          )
                        )
                      }
                    >
                      {workEvidenceLinkTypes.map(type => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Label</span>
                    <input
                      value={link.label}
                      maxLength={100}
                      onChange={event =>
                        setLinks(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Secure URL</span>
                    <input
                      value={link.url}
                      type="url"
                      placeholder="https://"
                      maxLength={500}
                      onChange={event =>
                        setLinks(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, url: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Availability</span>
                    <select
                      value={link.availability}
                      onChange={event =>
                        setLinks(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  availability: event.target
                                    .value as WorkEvidenceLink["availability"],
                                }
                              : item
                          )
                        )
                      }
                    >
                      {workEvidenceLinkAvailabilities.map(availability => (
                        <option key={availability} value={availability}>
                          {availability}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="profile-checkbox">
                    <input
                      type="checkbox"
                      checked={link.isPublic}
                      onChange={event =>
                        setLinks(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isPublic: event.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    <span>
                      Public{" "}
                      <small>
                        Private or unavailable references never expose their
                        URL.
                      </small>
                    </span>
                  </label>
                  <button
                    className="profile-remove"
                    type="button"
                    onClick={() =>
                      setLinks(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </fieldset>
              ))}
              <FieldError state={saveState} name="links" />
            </section>

            <section className="profile-section">
              <div className="profile-section-heading">
                <p className="profile-index">05 · Attribution and permission</p>
                <h2>Make collaboration and sharing boundaries explicit</h2>
                <p>
                  Team work cannot be presented as solely individual work. Add a
                  contributor or source, then decide whether the attribution is
                  public.
                </p>
              </div>
              <label className="profile-checkbox">
                <input
                  name="teamWork"
                  value="true"
                  type="checkbox"
                  defaultChecked={evidence.teamWork}
                />
                <span>
                  This was team or collaborative work{" "}
                  <small>
                    At least one public attribution is required before team work
                    can be public.
                  </small>
                </span>
              </label>
              <div className="profile-form-grid">
                <label>
                  <span>Ownership and permission</span>
                  <select
                    name="ownershipStatus"
                    defaultValue={evidence.ownershipStatus}
                  >
                    {workEvidenceOwnershipStatuses.map(status => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    Permission note{" "}
                    <small>Required for work you do not own.</small>
                  </span>
                  <input
                    name="permissionNote"
                    defaultValue={evidence.permissionNote}
                    maxLength={500}
                  />
                </label>
              </div>
              <button
                type="button"
                className="button button-secondary"
                disabled={attributions.length >= 12}
                onClick={() =>
                  setAttributions(current => [
                    ...current,
                    {
                      contributorName: "",
                      contributorRole: "",
                      sourceReferenceUrl: "",
                      isPublic: false,
                    },
                  ])
                }
              >
                Add attribution
              </button>
              {attributions.map((attribution, index) => (
                <fieldset
                  className="profile-link-row evidence-attribution-row"
                  key={`${attribution.contributorName}-${index}`}
                >
                  <legend>Contributor or source {index + 1}</legend>
                  <label>
                    <span>Name</span>
                    <input
                      value={attribution.contributorName}
                      maxLength={120}
                      onChange={event =>
                        setAttributions(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, contributorName: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Role or source context</span>
                    <input
                      value={attribution.contributorRole}
                      maxLength={120}
                      onChange={event =>
                        setAttributions(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, contributorRole: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>
                      Source URL <small>Optional</small>
                    </span>
                    <input
                      value={attribution.sourceReferenceUrl}
                      type="url"
                      placeholder="https://"
                      maxLength={500}
                      onChange={event =>
                        setAttributions(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  sourceReferenceUrl: event.target.value,
                                }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <label className="profile-checkbox">
                    <input
                      type="checkbox"
                      checked={attribution.isPublic}
                      onChange={event =>
                        setAttributions(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isPublic: event.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    <span>Public attribution</span>
                  </label>
                  <button
                    className="profile-remove"
                    type="button"
                    onClick={() =>
                      setAttributions(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </fieldset>
              ))}
              <FieldError state={saveState} name="attributions" />
              <FieldError state={saveState} name="permissionNote" />
            </section>
          </fieldset>
          {isArchived ? (
            <p className="profile-status" data-status="error">
              Archived evidence is preserved as a historical record and cannot
              be edited.
            </p>
          ) : (
            <div className="profile-save-bar">
              <div>
                <strong>Private draft</strong>
                <p>
                  Saving records a new private version. It does not make
                  anything public.
                </p>
              </div>
              <button className="button button-primary" type="submit">
                Save private draft
              </button>
            </div>
          )}
          <Status state={saveState} />
        </form>
        <aside className="profile-aside">
          <EvidencePreview context={context} />
          <CompletionChecklist context={context} />
          {evidence.id ? (
            <section
              className="profile-lifecycle"
              aria-labelledby="evidence-lifecycle-title"
            >
              <div>
                <p className="profile-kicker">Visibility lifecycle</p>
                <h2 id="evidence-lifecycle-title">
                  Control public presentation
                </h2>
                <p>
                  Public and unlisted views receive only the selected snapshot.
                  Evidence is not verified in this phase.
                </p>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{workEvidenceStateLabel(evidence.state)}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>v{evidence.version}</dd>
                </div>
                <div>
                  <dt>Public state</dt>
                  <dd>
                    {publication
                      ? workEvidenceStateLabel(publication.state)
                      : "Not published"}
                  </dd>
                </div>
                <div>
                  <dt>Public version</dt>
                  <dd>
                    {publication?.state === "published" ||
                    publication?.state === "unlisted"
                      ? `v${publication.sourceVersion}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {publication?.state === "published" ||
              publication?.state === "unlisted" ? (
                <p className="profile-status" data-status="success">
                  {publication.sourceVersion < evidence.version ? (
                    <>
                      Public snapshot uses v{publication.sourceVersion}. Current
                      draft is v{evidence.version}; save and publish again when
                      you want the public record to change.
                    </>
                  ) : (
                    <>
                      Public snapshot uses the current v
                      {publication.sourceVersion}. Save a new private draft
                      before changing what is public.
                    </>
                  )}
                </p>
              ) : null}
              {!isArchived ? (
                <>
                  <form action={previewAction}>
                    <input
                      type="hidden"
                      name="evidenceId"
                      value={evidence.id}
                    />
                    <button className="button button-secondary" type="submit">
                      Prepare private preview
                    </button>
                  </form>
                  <Status state={previewState} />
                  {evidence.state === "private" ? (
                    <form action={publishAction}>
                      <input
                        type="hidden"
                        name="evidenceId"
                        value={evidence.id}
                      />
                      <label>
                        <span>Publish as</span>
                        <select name="visibility" defaultValue="published">
                          <option value="published">
                            Published on my public profile
                          </option>
                          <option value="unlisted">Unlisted direct link</option>
                        </select>
                      </label>
                      <label className="profile-checkbox">
                        <input
                          name="confirmPublicEvidence"
                          value="confirmed"
                          type="checkbox"
                          checked={publishConfirmed}
                          onChange={event =>
                            setPublishConfirmed(event.target.checked)
                          }
                        />
                        <span>
                          I reviewed the public work, attribution, and link
                          visibility.
                        </span>
                      </label>
                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={!publishConfirmed}
                      >
                        Publish selected fields
                      </button>
                    </form>
                  ) : null}
                  {evidence.state === "published" ||
                  evidence.state === "unlisted" ? (
                    <form action={hideAction}>
                      <input
                        type="hidden"
                        name="evidenceId"
                        value={evidence.id}
                      />
                      <button className="button button-secondary" type="submit">
                        Hide from public presentation
                      </button>
                    </form>
                  ) : null}
                  <form action={archiveAction}>
                    <input
                      type="hidden"
                      name="evidenceId"
                      value={evidence.id}
                    />
                    <button className="button button-danger" type="submit">
                      Archive evidence
                    </button>
                  </form>
                </>
              ) : null}
              <Status state={publishState} />
              <Status state={hideState} />
              <Status state={archiveState} />
            </section>
          ) : null}
        </aside>
      </div>
    </AuthShell>
  );
}
