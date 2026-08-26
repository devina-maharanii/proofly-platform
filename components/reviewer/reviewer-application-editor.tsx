"use client";

/** Design: Evidence Ledger Editorial — graphite/fog records, restrained cobalt actions, and explicit status/source/next-action language. */
import { useActionState, useMemo, useState } from "react";

import {
  activateReviewerApplicationAction,
  saveReviewerApplicationAction,
  submitReviewerApplicationAction,
} from "@/lib/reviewer/actions";
import {
  initialReviewerActionState,
  reviewerApplicationStateLabel,
  reviewerConflictKinds,
  reviewerEvidenceTypeLabel,
  reviewerEvidenceTypes,
  type ReviewerApplication,
  type ReviewerConflictDeclaration,
  type ReviewerEvidence,
  type ReviewerSkill,
} from "@/lib/reviewer/types";
import {
  canonicalSkillFamilies,
  canonicalSkillLabel,
  type CanonicalSkillKey,
} from "@/lib/profile/types";

type EditableSkill = ReviewerSkill;
type EditableEvidence = Omit<ReviewerEvidence, "id">;
type EditableConflict = Omit<ReviewerConflictDeclaration, "id">;

const emptyEvidence = (): EditableEvidence => ({
  evidenceType: "professional_work",
  title: "",
  description: "",
  sourceUrl: "",
});

const emptyConflict = (): EditableConflict => ({
  relationshipKind: "close_collaboration",
  scope: "general",
  organizationId: null,
  context: "",
});

function ActionStatus({
  message,
  status,
}: Readonly<{ message: string; status: "idle" | "success" | "error" }>) {
  if (status === "idle") return null;
  return (
    <p
      className="reviewer-status"
      data-status={status}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

function StateNotice({
  application,
}: Readonly<{ application: ReviewerApplication | null }>) {
  if (!application) return null;
  const nextAction = {
    requested:
      "Add the requested evidence and submit when the application is complete.",
    in_screening:
      "A human administrator is reviewing the profile, evidence, conflicts, and policy agreement.",
    needs_more_evidence:
      "Read the private request below, update the relevant evidence, then submit again.",
    approved:
      "Activate reviewer access when you are ready; every opportunity remains eligibility-checked.",
    active:
      "Review access is active. Opportunities appear only when skill, conflict, capacity, and material checks pass.",
    paused:
      "Reviewer access is paused. Existing private materials remain protected and no new access is available.",
    suspended:
      "Reviewer access is suspended. Contact support through the approved policy path if clarification is needed.",
    rejected:
      "This application was not approved. The private record remains available for the applicable retention period.",
  }[application.state];
  return (
    <section
      className="reviewer-state-notice"
      data-state={application.state}
      aria-labelledby="reviewer-status-title"
    >
      <p className="reviewer-kicker">Application status</p>
      <div>
        <h2 id="reviewer-status-title">
          {reviewerApplicationStateLabel[application.state]}
        </h2>
        <p>{nextAction}</p>
        {application.resolutionNote ? (
          <p className="reviewer-resolution">
            <strong>Screening note:</strong> {application.resolutionNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ReviewerApplicationEditor({
  application,
}: Readonly<{ application: ReviewerApplication | null }>) {
  const profile = application?.profile;
  const [skills, setSkills] = useState<EditableSkill[]>(() => [
    ...(profile?.skills ?? []),
  ]);
  const [evidence, setEvidence] = useState<EditableEvidence[]>(
    () =>
      application?.evidence.map(item => ({
        evidenceType: item.evidenceType,
        title: item.title,
        description: item.description,
        sourceUrl: item.sourceUrl,
      })) ?? []
  );
  const [conflicts, setConflicts] = useState<EditableConflict[]>(
    () =>
      application?.conflicts.map(item => ({
        relationshipKind: item.relationshipKind,
        scope: item.scope,
        organizationId: item.organizationId,
        context: item.context,
      })) ?? []
  );
  const [saveState, saveAction, saving] = useActionState(
    saveReviewerApplicationAction,
    initialReviewerActionState
  );
  const [submitState, submitAction, submitting] = useActionState(
    submitReviewerApplicationAction,
    initialReviewerActionState
  );
  const [activateState, activateAction, activating] = useActionState(
    activateReviewerApplicationAction,
    initialReviewerActionState
  );
  const formDisabled = [
    "in_screening",
    "approved",
    "active",
    "paused",
    "suspended",
    "rejected",
  ].includes(application?.state ?? "requested");
  const selectedSkillKeys = useMemo(
    () => new Set(skills.map(skill => skill.skillKey)),
    [skills]
  );
  const formStatus = submitState.status !== "idle" ? submitState : saveState;

  return (
    <div className="reviewer-editor">
      <StateNotice application={application} />
      <section
        className="reviewer-expectations"
        aria-labelledby="reviewer-expectations-title"
      >
        <p className="reviewer-kicker">Human review responsibility</p>
        <h2 id="reviewer-expectations-title">
          Evidence supports qualification. It is not a prestige test.
        </h2>
        <p>
          Describe the work and review context that help an administrator assess
          fit. Proofly asks for practical evidence, current conduct agreement,
          capacity, and conflicts; it does not create a public reviewer score or
          ask you to make a final hiring decision.
        </p>
      </section>

      {application?.state === "approved" ? (
        <form action={activateAction} className="reviewer-activation-form">
          <p>
            <strong>Ready to activate?</strong> Activating confirms that
            opportunities still require matching expertise, no conflict,
            capacity, and explicit private material access.
          </p>
          <button
            className="reviewer-primary-button"
            type="submit"
            disabled={activating}
          >
            {activating ? "Activating…" : "Activate reviewer access"}
          </button>
          <ActionStatus {...activateState} />
        </form>
      ) : null}

      <form action={saveAction} className="reviewer-form">
        <fieldset disabled={formDisabled}>
          <section
            className="reviewer-section"
            aria-labelledby="reviewer-profile-title"
          >
            <div className="reviewer-section-heading">
              <p className="reviewer-kicker">01 · private profile</p>
              <h2 id="reviewer-profile-title">
                Professional context and availability
              </h2>
              <p>
                Only the approved administrator queue can view these application
                details. The public bio is stored as a profile field but is not
                published in this phase.
              </p>
            </div>
            <div className="reviewer-form-grid">
              <label>
                <span>Display name</span>
                <input
                  name="displayName"
                  defaultValue={profile?.displayName ?? ""}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                <span>Timezone</span>
                <input
                  name="timezone"
                  placeholder="Asia/Dhaka"
                  defaultValue={profile?.timezone ?? ""}
                  maxLength={80}
                  required
                />
              </label>
              <label className="reviewer-span-two">
                <span>Professional focus</span>
                <textarea
                  name="professionalFocus"
                  defaultValue={profile?.professionalFocus ?? ""}
                  maxLength={500}
                  required
                />
              </label>
              <label className="reviewer-span-two">
                <span>Experience context</span>
                <textarea
                  name="experienceContext"
                  defaultValue={profile?.experienceContext ?? ""}
                  maxLength={1400}
                  required
                />
              </label>
              <label className="reviewer-span-two">
                <span>Review or assessment experience</span>
                <textarea
                  name="reviewExperience"
                  defaultValue={profile?.reviewExperience ?? ""}
                  maxLength={1400}
                  required
                />
              </label>
              <label>
                <span>
                  Languages <small>Comma-separated</small>
                </span>
                <input
                  name="languages"
                  defaultValue={profile?.languages.join(", ") ?? ""}
                  maxLength={480}
                  required
                />
              </label>
              <label>
                <span>Availability</span>
                <select
                  name="availabilityStatus"
                  defaultValue={profile?.availabilityStatus ?? "unavailable"}
                >
                  <option value="available">Available</option>
                  <option value="limited">Limited</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </label>
              <label>
                <span>Maximum concurrent reviews</span>
                <input
                  name="maxConcurrentReviews"
                  type="number"
                  min="1"
                  max="25"
                  defaultValue={profile?.maxConcurrentReviews ?? 1}
                  required
                />
              </label>
              <label className="reviewer-span-two">
                <span>Feedback style</span>
                <textarea
                  name="feedbackStyle"
                  defaultValue={profile?.feedbackStyle ?? ""}
                  maxLength={700}
                  required
                />
              </label>
              <label className="reviewer-span-two">
                <span>
                  Public reviewer bio{" "}
                  <small>
                    Stored privately; no public reviewer profile is released in
                    Phase 27.
                  </small>
                </span>
                <textarea
                  name="publicBio"
                  defaultValue={profile?.publicBio ?? ""}
                  maxLength={900}
                  required
                />
              </label>
            </div>
          </section>

          <section
            className="reviewer-section"
            aria-labelledby="reviewer-skills-title"
          >
            <div className="reviewer-section-heading">
              <p className="reviewer-kicker">02 · governed expertise</p>
              <h2 id="reviewer-skills-title">Canonical software skills</h2>
              <p>
                Select the exact skill keys you can evaluate against a defined
                rubric. A “Reviewer” skill level alone never grants approval.
              </p>
            </div>
            <input
              type="hidden"
              name="skills"
              value={JSON.stringify(skills)}
              readOnly
            />
            <div className="reviewer-inline-add">
              <select aria-label="Add canonical reviewer skill" defaultValue="">
                <option value="" disabled>
                  Choose a canonical skill
                </option>
                {canonicalSkillFamilies.map(family => (
                  <optgroup key={family.key} label={family.label}>
                    {family.skills.map(([key, label]) => (
                      <option
                        key={key}
                        value={key}
                        disabled={selectedSkillKeys.has(
                          key as CanonicalSkillKey
                        )}
                      >
                        {label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={event => {
                  const skillKey = (
                    event.currentTarget
                      .previousElementSibling as HTMLSelectElement
                  ).value as CanonicalSkillKey;
                  if (skillKey && !selectedSkillKeys.has(skillKey))
                    setSkills(current => [
                      ...current,
                      { skillKey, expertiseContext: "" },
                    ]);
                }}
              >
                Add skill
              </button>
            </div>
            <div className="reviewer-row-list">
              {skills.map((skill, index) => (
                <div className="reviewer-row" key={skill.skillKey}>
                  <strong>{canonicalSkillLabel(skill.skillKey)}</strong>
                  <label>
                    <span>Review context</span>
                    <input
                      value={skill.expertiseContext}
                      maxLength={500}
                      onChange={event =>
                        setSkills(current =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  expertiseContext: event.target.value,
                                }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="reviewer-remove"
                    onClick={() =>
                      setSkills(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!skills.length ? (
                <p className="reviewer-empty">
                  No expertise is selected yet. Add at least one canonical skill
                  before you submit.
                </p>
              ) : null}
            </div>
          </section>

          <section
            className="reviewer-section"
            aria-labelledby="reviewer-evidence-title"
          >
            <div className="reviewer-section-heading">
              <p className="reviewer-kicker">03 · practical evidence</p>
              <h2 id="reviewer-evidence-title">
                Relevant work, review, or reference context
              </h2>
              <p>
                Use professional work, open source, mentorship, previous
                assessment work, technical writing, or an appropriate reference.
                Do not add private client materials without permission.
              </p>
            </div>
            <input
              type="hidden"
              name="evidence"
              value={JSON.stringify(evidence)}
              readOnly
            />
            <button
              type="button"
              className="reviewer-secondary-button"
              onClick={() =>
                setEvidence(current => [...current, emptyEvidence()])
              }
            >
              Add evidence
            </button>
            <div className="reviewer-stack">
              {evidence.map((item, index) => (
                <fieldset
                  className="reviewer-evidence-card"
                  key={`${item.title}-${index}`}
                >
                  <legend>Evidence {index + 1}</legend>
                  <div className="reviewer-form-grid">
                    <label>
                      <span>Evidence type</span>
                      <select
                        value={item.evidenceType}
                        onChange={event =>
                          setEvidence(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    evidenceType: event.target
                                      .value as EditableEvidence["evidenceType"],
                                  }
                                : entry
                            )
                          )
                        }
                      >
                        {reviewerEvidenceTypes.map(type => (
                          <option key={type} value={type}>
                            {reviewerEvidenceTypeLabel[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Title</span>
                      <input
                        value={item.title}
                        maxLength={160}
                        onChange={event =>
                          setEvidence(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, title: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </label>
                    <label className="reviewer-span-two">
                      <span>Description</span>
                      <textarea
                        value={item.description}
                        maxLength={1400}
                        onChange={event =>
                          setEvidence(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, description: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </label>
                    <label className="reviewer-span-two">
                      <span>
                        HTTPS reference <small>Optional</small>
                      </span>
                      <input
                        type="url"
                        value={item.sourceUrl}
                        maxLength={500}
                        onChange={event =>
                          setEvidence(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, sourceUrl: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="reviewer-remove"
                    onClick={() =>
                      setEvidence(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove evidence
                  </button>
                </fieldset>
              ))}
              {!evidence.length ? (
                <p className="reviewer-empty">
                  Add at least one practical evidence record before requesting
                  approval.
                </p>
              ) : null}
            </div>
          </section>

          <section
            className="reviewer-section"
            aria-labelledby="reviewer-conflicts-title"
          >
            <div className="reviewer-section-heading">
              <p className="reviewer-kicker">04 · independence</p>
              <h2 id="reviewer-conflicts-title">Declare material conflicts</h2>
              <p>
                Reviewers cannot review their own work or compromised close
                collaborator work. A general conflict blocks every opportunity;
                an organization conflict blocks that organization only.
              </p>
            </div>
            <input
              type="hidden"
              name="conflicts"
              value={JSON.stringify(conflicts)}
              readOnly
            />
            <button
              type="button"
              className="reviewer-secondary-button"
              onClick={() =>
                setConflicts(current => [...current, emptyConflict()])
              }
            >
              Add conflict declaration
            </button>
            <div className="reviewer-stack">
              {conflicts.map((conflict, index) => (
                <fieldset
                  className="reviewer-evidence-card"
                  key={`${conflict.relationshipKind}-${index}`}
                >
                  <legend>Conflict {index + 1}</legend>
                  <div className="reviewer-form-grid">
                    <label>
                      <span>Relationship</span>
                      <select
                        value={conflict.relationshipKind}
                        onChange={event =>
                          setConflicts(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    relationshipKind: event.target
                                      .value as EditableConflict["relationshipKind"],
                                  }
                                : entry
                            )
                          )
                        }
                      >
                        {reviewerConflictKinds.map(kind => (
                          <option key={kind} value={kind}>
                            {kind.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Scope</span>
                      <select
                        value={conflict.scope}
                        onChange={event =>
                          setConflicts(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    scope: event.target
                                      .value as EditableConflict["scope"],
                                    organizationId: null,
                                  }
                                : entry
                            )
                          )
                        }
                      >
                        <option value="general">General</option>
                        <option value="organization">Organization</option>
                      </select>
                    </label>
                    {conflict.scope === "organization" ? (
                      <label className="reviewer-span-two">
                        <span>Organization ID</span>
                        <input
                          value={conflict.organizationId ?? ""}
                          placeholder="Organization UUID"
                          onChange={event =>
                            setConflicts(current =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      organizationId:
                                        event.target.value || null,
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      </label>
                    ) : null}
                    <label className="reviewer-span-two">
                      <span>Context</span>
                      <textarea
                        value={conflict.context}
                        maxLength={700}
                        onChange={event =>
                          setConflicts(current =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, context: event.target.value }
                                : entry
                            )
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="reviewer-remove"
                    onClick={() =>
                      setConflicts(current =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    Remove declaration
                  </button>
                </fieldset>
              ))}
              {!conflicts.length ? (
                <p className="reviewer-empty">
                  No additional conflict declaration added. You must still
                  acknowledge the no-self-review and impartiality policy before
                  submitting.
                </p>
              ) : null}
            </div>
          </section>

          <section
            className="reviewer-policy"
            aria-labelledby="reviewer-policy-title"
          >
            <p className="reviewer-kicker">05 · conduct agreement</p>
            <h2 id="reviewer-policy-title">
              Current reviewer conduct policy · v1
            </h2>
            <p>
              Review work must be independent, conflict-aware,
              evidence-grounded, and auditable. Companies cannot silently
              determine a favorable outcome; approval is a human operational
              decision, not AI output.
            </p>
            <label>
              <input name="acknowledgeConflicts" type="checkbox" /> I declare
              relevant conflicts and understand that I cannot review my own work
              or compromised collaborator work.
            </label>
            <label>
              <input name="acknowledgePolicy" type="checkbox" /> I agree to the
              current reviewer conduct policy for this application.
            </label>
          </section>
        </fieldset>
        <div className="reviewer-form-actions">
          <button
            className="reviewer-secondary-button"
            type="submit"
            disabled={formDisabled || saving}
          >
            {saving ? "Saving…" : "Save private draft"}
          </button>
          <button
            className="reviewer-primary-button"
            type="submit"
            formAction={submitAction}
            disabled={formDisabled || submitting}
          >
            {submitting ? "Submitting…" : "Request human screening"}
          </button>
        </div>
        <ActionStatus {...formStatus} />
      </form>
    </div>
  );
}
