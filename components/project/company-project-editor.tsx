"use client";

/** Phase 25 style: a dense but calm precision-editorial organization project editor; it keeps scope, fairness, and lifecycle legible while linking only to an authorized workspace shell, never messaging, reviews, contracts, payments, or AI tools. */
import Link from "next/link";
import type { Route } from "next";
import { useActionState, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  canonicalSkillFamilies,
  canonicalSkillLabel,
} from "@/lib/profile/types";
import {
  prepareCompanyProjectPreviewAction,
  publishCompanyProjectAction,
  saveCompanyProjectAction,
  transitionCompanyProjectAction,
} from "@/lib/project/actions";
import { projectReadinessIssues } from "@/lib/project/validation";
import {
  emptyCompanyProject,
  initialProjectActionState,
  privateCompanyProjectPath,
  projectStateLabel,
  projectTypeLabel,
  publicProjectPath,
  type CompanyProject,
  type CompanyProjectContext,
  type EvaluationDimension,
  type ProjectActionState,
  type ProjectMilestone,
  type ProjectState,
  type ProjectType,
} from "@/lib/project/types";

type EditorContext =
  | CompanyProjectContext
  | Readonly<{
      project: CompanyProject;
      publication: null;
      activeCompanyContext: boolean;
      canEdit: boolean;
      canPublish: boolean;
    }>;

const typeGuidance: Record<
  ProjectType,
  Readonly<{ title: string; description: string; visibility: string }>
> = {
  public_challenge: {
    title: "Comparable evidence, clear public context",
    description:
      "Use this for a bounded challenge whose requirements and fairness terms can be publicly read. A direct page is not an application form or a message channel.",
    visibility: "Public after owner publication",
  },
  private_invite_only: {
    title: "Restricted project context",
    description:
      "Use this when the project definition should remain organization-restricted. This phase does not issue, accept, or manage invitations; no public page is created.",
    visibility: "Restricted to authorized organization members",
  },
  portfolio_prompt: {
    title: "Portfolio-facing prompt",
    description:
      "Describe a bounded prompt that can demonstrate relevant work. State what is evaluated and what will not be reused as production work.",
    visibility: "Public after owner publication",
  },
  hiring_evaluation: {
    title: "Transparent hiring evaluation",
    description:
      "Explain the exercise, evaluation dimensions, response timeline, and IP boundary before any later application workflow exists.",
    visibility: "Public after owner publication",
  },
  future_paid_trial: {
    title: "Future paid-trial context",
    description:
      "Describe a possible paid-trial project with an explicit compensation context. Trial execution, contract formation, and payment processing are unavailable in this phase.",
    visibility: "Public after owner publication",
  },
};

function Status({ state }: Readonly<{ state: ProjectActionState }>) {
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
}: Readonly<{ state: ProjectActionState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="profile-field-error">{message}</p> : null;
}

function MultiSkillSelect({
  id,
  label,
  selected,
  onChange,
  description,
}: Readonly<{
  id: string;
  label: string;
  selected: string[];
  onChange: (next: string[]) => void;
  description: string;
}>) {
  return (
    <label>
      <span>{label}</span>
      <select
        id={id}
        multiple
        value={selected}
        onChange={event =>
          onChange(
            Array.from(event.currentTarget.selectedOptions).map(
              option => option.value
            )
          )
        }
        aria-describedby={`${id}-help`}
      >
        {canonicalSkillFamilies.map(family => (
          <optgroup key={family.key} label={family.label}>
            {family.skills.map(([key, skillLabel]) => (
              <option key={key} value={key}>
                {skillLabel}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <small id={`${id}-help`}>{description}</small>
    </label>
  );
}

function StructuredList<T extends ProjectMilestone | EvaluationDimension>({
  label,
  description,
  values,
  onChange,
  kind,
}: Readonly<{
  label: string;
  description: string;
  values: T[];
  onChange: (values: T[]) => void;
  kind: "milestone" | "dimension";
}>) {
  const add = () => {
    if (values.length >= (kind === "milestone" ? 8 : 6)) return;
    const next =
      kind === "milestone"
        ? ([...values, { name: "", description: "" }] as T[])
        : ([...values, { criterion: "", priority: 0 }] as T[]);
    onChange(next);
  };
  return (
    <fieldset className="project-structured-fieldset">
      <legend>{label}</legend>
      <p>{description}</p>
      <div className="project-structured-list">
        {values.map((value, index) => (
          <div className="project-structured-row" key={`${kind}-${index}`}>
            {kind === "milestone" ? (
              <>
                <label>
                  <span>Milestone</span>
                  <input
                    value={(value as ProjectMilestone).name}
                    maxLength={100}
                    onChange={event => {
                      const next = [...values];
                      next[index] = {
                        ...(value as ProjectMilestone),
                        name: event.target.value,
                      } as T;
                      onChange(next);
                    }}
                  />
                </label>
                <label>
                  <span>Boundary or outcome</span>
                  <input
                    value={(value as ProjectMilestone).description}
                    maxLength={480}
                    onChange={event => {
                      const next = [...values];
                      next[index] = {
                        ...(value as ProjectMilestone),
                        description: event.target.value,
                      } as T;
                      onChange(next);
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  <span>Evaluation dimension</span>
                  <input
                    value={(value as EvaluationDimension).criterion}
                    maxLength={280}
                    onChange={event => {
                      const next = [...values];
                      next[index] = {
                        ...(value as EvaluationDimension),
                        criterion: event.target.value,
                      } as T;
                      onChange(next);
                    }}
                  />
                </label>
                <label>
                  <span>Priority (%)</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={(value as EvaluationDimension).priority || ""}
                    onChange={event => {
                      const next = [...values];
                      next[index] = {
                        ...(value as EvaluationDimension),
                        priority: Number(event.target.value) || 0,
                      } as T;
                      onChange(next);
                    }}
                  />
                </label>
              </>
            )}
            <button
              className="profile-remove"
              type="button"
              onClick={() =>
                onChange(values.filter((_, item) => item !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button className="button button-secondary" type="button" onClick={add}>
        Add {kind === "milestone" ? "milestone" : "evaluation dimension"}
      </button>
    </fieldset>
  );
}

function ProjectPreview({
  project,
  state,
}: Readonly<{ project: CompanyProject; state: ProjectState }>) {
  return (
    <section
      className="profile-preview"
      aria-labelledby="project-preview-title"
    >
      <div className="profile-preview-heading">
        <div>
          <p className="profile-kicker">Private project preview</p>
          <h2 id="project-preview-title">How the defined context reads</h2>
        </div>
        <span className="profile-state-badge">{projectStateLabel(state)}</span>
      </div>
      <div className="profile-preview-surface project-preview-surface">
        <p className="profile-preview-name">
          {project.title || "Project title"}
        </p>
        <p className="profile-preview-headline">
          {project.oneSentenceGoal || "A one-sentence goal belongs here."}
        </p>
        <dl className="profile-preview-meta">
          <div>
            <dt>Type</dt>
            <dd>{projectTypeLabel(project.projectType)}</dd>
          </div>
          <div>
            <dt>Work purpose</dt>
            <dd>{project.workPurpose.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Compensation context</dt>
            <dd>{project.compensationStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Timebox</dt>
            <dd>
              {project.timeboxHours
                ? `${project.timeboxHours} hours`
                : "Not set"}
            </dd>
          </div>
        </dl>
        <p className="profile-proof-boundary">
          <strong>Scope boundary:</strong> this page provides project context
          only. Application and workspace access require their own authorized
          relationship; this page does not grant access to private work, review,
          messaging, contracts, or payments.
        </p>
      </div>
    </section>
  );
}

function LifecycleControls({
  context,
  projectId,
  project,
}: Readonly<{
  context: EditorContext;
  projectId: string;
  project: CompanyProject;
}>) {
  const [previewState, previewAction] = useActionState(
    prepareCompanyProjectPreviewAction,
    initialProjectActionState
  );
  const [publishState, publishAction] = useActionState(
    publishCompanyProjectAction,
    initialProjectActionState
  );
  const [transitionState, transitionAction] = useActionState(
    transitionCompanyProjectAction,
    initialProjectActionState
  );
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const readiness = projectReadinessIssues(project);
  const completeness = Object.keys(readiness).length === 0;
  const transitions: Partial<Record<ProjectState, ProjectState[]>> = {
    published: ["accepting_applications", "paused", "closed"],
    accepting_applications: ["paused", "in_progress", "closed"],
    paused: ["published", "accepting_applications", "closed"],
    in_progress: ["closed"],
    closed: ["archived"],
  };
  const currentTransitions = transitions[project.state] ?? [];

  return (
    <section
      className="profile-lifecycle"
      aria-labelledby="project-lifecycle-title"
    >
      <p className="profile-kicker">Visibility and lifecycle</p>
      <h2 id="project-lifecycle-title">Preview, publish, and preserve state</h2>
      <p>
        Drafts stay private. Only an organization owner can preview, publish, or
        change an operational state. A restricted project does not expose an
        invitation route in this phase.
      </p>
      <dl>
        <div>
          <dt>Draft</dt>
          <dd>Private to authorized organization members.</dd>
        </div>
        <div>
          <dt>Preview</dt>
          <dd>Private owner review before an explicit publication choice.</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>Direct public context only when the visibility allows it.</dd>
        </div>
        <div>
          <dt>Accepting applications</dt>
          <dd>
            Eligible talent can use the focused application flow; organization
            review remains separate.
          </dd>
        </div>
        <div>
          <dt>Closed or archived</dt>
          <dd>Public resolution ends; authorized audit history remains.</dd>
        </div>
      </dl>
      {context.canPublish ? (
        <>
          {project.state === "draft" ? (
            <form action={previewAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <button className="button button-secondary" type="submit">
                Prepare private preview
              </button>
              <Status state={previewState} />
            </form>
          ) : null}
          {project.state === "preview" ? (
            <form action={publishAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <label className="profile-checkbox">
                <input
                  type="checkbox"
                  name="confirmProjectPublication"
                  value="confirmed"
                  checked={publishConfirmed}
                  onChange={event => setPublishConfirmed(event.target.checked)}
                />
                <span>
                  <strong>I reviewed the public project fields</strong>
                  <small>
                    Scope, timebox, compensation, ownership, data boundaries,
                    participant expectations, and response timeline are
                    explicit.
                  </small>
                </span>
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={!publishConfirmed || !completeness}
              >
                Publish approved project context
              </button>
              {!completeness ? (
                <p className="profile-field-error">
                  Complete the required project and fairness fields before
                  publishing.
                </p>
              ) : null}
              <Status state={publishState} />
            </form>
          ) : null}
          {currentTransitions.length > 0 ? (
            <form action={transitionAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <label>
                <span>Next state</span>
                <select
                  name="requestedState"
                  defaultValue={currentTransitions[0]}
                >
                  {currentTransitions.map(nextState => (
                    <option key={nextState} value={nextState}>
                      {projectStateLabel(nextState)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button-secondary" type="submit">
                Record state change
              </button>
              <Status state={transitionState} />
            </form>
          ) : null}
        </>
      ) : (
        <p className="profile-proof-boundary">
          <strong>Publication authority:</strong> an organization owner must
          review, publish, or change this project’s lifecycle state. Hiring
          members can save a private draft only.
        </p>
      )}
      {context.publication && project.visibility === "public" ? (
        <a
          className="profile-public-link"
          href={publicProjectPath(project.publicId)}
        >
          Open public project page <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </section>
  );
}

export function CompanyProjectEditor({
  context,
}: Readonly<{ context: EditorContext }>) {
  const initialProject = context.project;
  const [projectType, setProjectType] = useState(initialProject.projectType);
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    initialProject.requiredSkills
  );
  const [helpfulSkills, setHelpfulSkills] = useState<string[]>(
    initialProject.helpfulSkills
  );
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(
    initialProject.milestones
  );
  const [evaluationDimensions, setEvaluationDimensions] = useState<
    EvaluationDimension[]
  >(initialProject.evaluationDimensions);
  const [saveState, saveAction] = useActionState(
    saveCompanyProjectAction,
    initialProjectActionState
  );
  const projectId = saveState.projectId ?? initialProject.id;
  const guidance = typeGuidance[projectType];
  const selectedSkillsText = useMemo(
    () => requiredSkills.map(canonicalSkillLabel).join(", "),
    [requiredSkills]
  );

  if (!context.activeCompanyContext) {
    return (
      <AuthShell
        eyebrow="Project creation"
        title="Switch to an active company context"
        description="Projects belong to an organization. Select an active company membership before viewing or changing a private project draft."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose a company context
        </Link>
      </AuthShell>
    );
  }

  if (!context.canEdit) {
    return (
      <AuthShell
        eyebrow="Project creation"
        title="This membership cannot create a project"
        description="An organization owner or authorized hiring member can prepare a private Project or Challenge definition. This page does not grant new organization administration access."
      >
        <Link className="button button-primary" href="/auth/continue">
          Choose another context
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Project creation"
      title="Define fair work before any participation workflow exists"
      description="Save a private organization draft first. The project must make scope, time, evaluation, ownership, compensation, and response expectations clear before an owner can publish it."
    >
      <nav className="profile-nav" aria-label="Project creation sections">
        <a href="#definition">Definition</a>
        <a href="#deliverables">Deliverables</a>
        <a href="#evaluation">Evaluation</a>
        <a href="#fairness">Fairness</a>
        <a href="#preview">Preview</a>
      </nav>
      <div className="profile-layout project-editor-layout">
        <form action={saveAction} className="profile-editor-form">
          <input type="hidden" name="projectId" value={initialProject.id} />
          <input
            type="hidden"
            name="requiredSkills"
            value={JSON.stringify(requiredSkills)}
          />
          <input
            type="hidden"
            name="helpfulSkills"
            value={JSON.stringify(helpfulSkills)}
          />
          <input
            type="hidden"
            name="milestones"
            value={JSON.stringify(milestones)}
          />
          <input
            type="hidden"
            name="evaluationDimensions"
            value={JSON.stringify(evaluationDimensions)}
          />
          <section
            className="profile-section"
            id="definition"
            aria-labelledby="project-definition-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">01 / definition</p>
              <h2 id="project-definition-title">
                Start with a truthful project type and problem
              </h2>
              <p>
                Project type changes guidance and visibility. It does not create
                an application, invitation, hiring decision, contract, or
                payment flow.
              </p>
            </div>
            <div
              className="project-type-guidance"
              data-project-type={projectType}
            >
              <p className="profile-kicker">{guidance.visibility}</p>
              <h3>{guidance.title}</h3>
              <p>{guidance.description}</p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Project type</span>
                <select
                  name="projectType"
                  value={projectType}
                  onChange={event =>
                    setProjectType(event.target.value as ProjectType)
                  }
                >
                  {Object.entries(typeGuidance).map(([type]) => (
                    <option key={type} value={type}>
                      {projectTypeLabel(type as ProjectType)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Project title</span>
                <input
                  name="title"
                  defaultValue={initialProject.title}
                  maxLength={120}
                  placeholder="Improve a bounded onboarding handoff"
                />
                <FieldError state={saveState} name="title" />
              </label>
            </div>
            <label>
              <span>One-sentence goal</span>
              <input
                name="oneSentenceGoal"
                defaultValue={initialProject.oneSentenceGoal}
                maxLength={280}
                placeholder="Explain the intended outcome in clear, observable language."
              />
              <FieldError state={saveState} name="oneSentenceGoal" />
            </label>
            <label>
              <span>Context and user problem</span>
              <textarea
                name="contextAndProblem"
                defaultValue={initialProject.contextAndProblem}
                rows={5}
                maxLength={1800}
                placeholder="Describe the user context and product problem without personal eligibility criteria."
              />
              <FieldError state={saveState} name="contextAndProblem" />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>Why this work matters</span>
                <textarea
                  name="whyItMatters"
                  defaultValue={initialProject.whyItMatters}
                  rows={4}
                  maxLength={900}
                />
                <FieldError state={saveState} name="whyItMatters" />
              </label>
              <label>
                <span>Expected role or contribution context</span>
                <textarea
                  name="expectedRole"
                  defaultValue={initialProject.expectedRole}
                  rows={4}
                  maxLength={160}
                />
                <FieldError state={saveState} name="expectedRole" />
              </label>
              <label>
                <span>Experience context</span>
                <textarea
                  name="experienceContext"
                  defaultValue={initialProject.experienceContext}
                  rows={4}
                  maxLength={500}
                  placeholder="Describe relevant practice or evidence context, not demographic eligibility."
                />
                <FieldError state={saveState} name="experienceContext" />
              </label>
            </div>
            <div className="profile-form-grid">
              <MultiSkillSelect
                id="required-skills"
                label="Required canonical skills"
                selected={requiredSkills}
                onChange={setRequiredSkills}
                description="Choose one or more governed skill keys. These do not infer skill or rank a person."
              />
              <MultiSkillSelect
                id="helpful-skills"
                label="Helpful canonical skills"
                selected={helpfulSkills}
                onChange={setHelpfulSkills}
                description="Keep helpful skills distinct from required skills."
              />
            </div>
            <p className="project-skill-summary">
              <strong>Required signal:</strong>{" "}
              {selectedSkillsText || "No required skills selected yet."}
            </p>
            <FieldError state={saveState} name="requiredSkills" />
            <FieldError state={saveState} name="helpfulSkills" />
          </section>

          <section
            className="profile-section"
            id="deliverables"
            aria-labelledby="project-deliverables-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">02 / deliverables</p>
              <h2 id="project-deliverables-title">
                Bound the output, time, and exclusions
              </h2>
              <p>
                Clear deliverables prevent an evaluation exercise from becoming
                hidden production work.
              </p>
            </div>
            <label>
              <span>Required output</span>
              <textarea
                name="requiredOutput"
                defaultValue={initialProject.requiredOutput}
                rows={4}
                maxLength={1200}
              />
              <FieldError state={saveState} name="requiredOutput" />
            </label>
            <label>
              <span>Acceptance criteria</span>
              <textarea
                name="acceptanceCriteria"
                defaultValue={initialProject.acceptanceCriteria}
                rows={5}
                maxLength={1400}
                placeholder="List observable conditions rather than subjective personal traits."
              />
              <FieldError state={saveState} name="acceptanceCriteria" />
            </label>
            <div className="profile-form-grid">
              <label>
                <span>Submission format</span>
                <input
                  name="submissionFormat"
                  defaultValue={initialProject.submissionFormat}
                  maxLength={600}
                  placeholder="For example: repository link and short written walkthrough"
                />
                <FieldError state={saveState} name="submissionFormat" />
              </label>
              <label>
                <span>Expected timebox (hours)</span>
                <input
                  name="timeboxHours"
                  type="number"
                  min="1"
                  max="160"
                  defaultValue={initialProject.timeboxHours ?? ""}
                />
                <small>
                  Evaluation exercises are capped at 20 hours. Use a realistic,
                  bounded amount.
                </small>
                <FieldError state={saveState} name="timeboxHours" />
              </label>
            </div>
            <StructuredList
              kind="milestone"
              label="Milestones, where applicable"
              description="Optional bounded checkpoints. This phase does not create task tracking or workspace access."
              values={milestones}
              onChange={setMilestones}
            />
            <label>
              <span>Explicitly out of scope</span>
              <textarea
                name="outOfScope"
                defaultValue={initialProject.outOfScope}
                rows={4}
                maxLength={900}
                placeholder="State excluded features, production use, data access, or deliverables."
              />
              <FieldError state={saveState} name="outOfScope" />
            </label>
          </section>

          <section
            className="profile-section"
            id="evaluation"
            aria-labelledby="project-evaluation-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">03 / evaluation</p>
              <h2 id="project-evaluation-title">
                Make evaluation explainable before it exists
              </h2>
              <p>
                Explain method, dimensions, reviewer expectations, revisions,
                and decision timing. No reviewer queue or assignment is created
                here.
              </p>
            </div>
            <label>
              <span>Rubric setup</span>
              <select
                name="rubricSetup"
                defaultValue={initialProject.rubricSetup}
              >
                <option value="defined">
                  Evaluation dimensions are defined now
                </option>
                <option value="later">
                  Rubric setup is explicitly planned for later
                </option>
              </select>
              <small>
                Marking a rubric for later does not imply automated or opaque
                evaluation.
              </small>
            </label>
            {initialProject.id && context.canEdit ? (
              <p className="project-rubric-handoff">
                <Link
                  href={
                    `/company/projects/${initialProject.id}/rubric` as Route
                  }
                >
                  Author a versioned project rubric
                </Link>{" "}
                <span>
                  Create contextual descriptors, calibration guidance, and
                  explicit feedback visibility. This does not assign reviewers
                  or start a review.
                </span>
              </p>
            ) : null}
            <StructuredList
              kind="dimension"
              label="Evaluation dimensions and priority"
              description="When defined, priorities must total 100. Criteria cannot rely on protected characteristics."
              values={evaluationDimensions}
              onChange={setEvaluationDimensions}
            />
            <FieldError state={saveState} name="evaluationDimensions" />
            <div className="profile-form-grid">
              <label>
                <span>Review method</span>
                <textarea
                  name="reviewMethod"
                  defaultValue={initialProject.reviewMethod}
                  rows={4}
                  maxLength={600}
                />
                <FieldError state={saveState} name="reviewMethod" />
              </label>
              <label>
                <span>Reviewer expectations</span>
                <textarea
                  name="reviewerExpectations"
                  defaultValue={initialProject.reviewerExpectations}
                  rows={4}
                  maxLength={600}
                  placeholder="State who is expected to review and what explanation they should provide."
                />
                <FieldError state={saveState} name="reviewerExpectations" />
              </label>
              <label>
                <span>Revision policy</span>
                <textarea
                  name="revisionPolicy"
                  defaultValue={initialProject.revisionPolicy}
                  rows={4}
                  maxLength={600}
                />
                <FieldError state={saveState} name="revisionPolicy" />
              </label>
              <label>
                <span>Decision timeline</span>
                <textarea
                  name="decisionTimeline"
                  defaultValue={initialProject.decisionTimeline}
                  rows={4}
                  maxLength={320}
                />
                <FieldError state={saveState} name="decisionTimeline" />
              </label>
            </div>
          </section>

          <section
            className="profile-section"
            id="fairness"
            aria-labelledby="project-fairness-title"
          >
            <div className="profile-section-heading">
              <p className="profile-index">04 / opportunity and fairness</p>
              <h2 id="project-fairness-title">
                State compensation, ownership, and participant expectations
                plainly
              </h2>
              <p>
                Paid-trial execution and payment are not available here. Do not
                represent evaluation work as a path to unpaid production use.
              </p>
            </div>
            <div className="profile-form-grid">
              <label>
                <span>Work purpose</span>
                <select
                  name="workPurpose"
                  defaultValue={initialProject.workPurpose}
                >
                  <option value="evaluation_exercise">
                    Evaluation exercise
                  </option>
                  <option value="production_need">Real production need</option>
                </select>
              </label>
              <label>
                <span>Compensation status</span>
                <select
                  name="compensationStatus"
                  defaultValue={initialProject.compensationStatus}
                >
                  <option value="paid_defined">
                    Paid: compensation context is defined
                  </option>
                  <option value="paid_to_be_agreed">
                    Paid: compensation to be agreed
                  </option>
                  <option value="unpaid_evaluation">
                    Unpaid evaluation exercise only
                  </option>
                </select>
                <FieldError state={saveState} name="compensationStatus" />
              </label>
              <label>
                <span>Participant limit</span>
                <input
                  name="participantLimit"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={initialProject.participantLimit ?? ""}
                />
                <FieldError state={saveState} name="participantLimit" />
              </label>
              <label>
                <span>Participation deadline</span>
                <input
                  name="applicationDeadline"
                  type="date"
                  defaultValue={initialProject.applicationDeadline}
                />
                <small>
                  This date is disclosed context only. Applications are not
                  implemented in this phase.
                </small>
                <FieldError state={saveState} name="applicationDeadline" />
              </label>
            </div>
            <label>
              <span>Ownership and IP terms</span>
              <textarea
                name="ownershipTerms"
                defaultValue={initialProject.ownershipTerms}
                rows={4}
                maxLength={900}
                placeholder="State who owns outputs and whether work may be reused."
              />
              <FieldError state={saveState} name="ownershipTerms" />
            </label>
            <label>
              <span>Data and access restrictions</span>
              <textarea
                name="dataAccessRestrictions"
                defaultValue={initialProject.dataAccessRestrictions}
                rows={4}
                maxLength={900}
                placeholder="State what data, credentials, systems, or confidential materials are excluded."
              />
              <small>
                Attachments and uploads are not enabled in Phase 22; no files
                are made public.
              </small>
              <FieldError state={saveState} name="dataAccessRestrictions" />
            </label>
            <label className="profile-checkbox">
              <input
                name="noProductionReuse"
                type="checkbox"
                value="true"
                defaultChecked={initialProject.noProductionReuse}
              />
              <span>
                <strong>
                  No production reuse or ownership transfer for this evaluation
                  exercise
                </strong>
                <small>
                  Required whenever the work purpose is an evaluation exercise.
                </small>
              </span>
            </label>
            <FieldError state={saveState} name="noProductionReuse" />
            <div className="profile-form-grid">
              <label>
                <span>Participant expectations</span>
                <textarea
                  name="participantExpectations"
                  defaultValue={initialProject.participantExpectations}
                  rows={4}
                  maxLength={900}
                  placeholder="State what participants should prepare, what support exists, and what is not promised."
                />
                <FieldError state={saveState} name="participantExpectations" />
              </label>
              <label>
                <span>Expected response time</span>
                <textarea
                  name="expectedResponseTime"
                  defaultValue={initialProject.expectedResponseTime}
                  rows={4}
                  maxLength={320}
                  placeholder="For example: a decision-context update within ten business days of the stated deadline."
                />
                <FieldError state={saveState} name="expectedResponseTime" />
              </label>
            </div>
          </section>
          <div className="profile-save-bar">
            <div>
              <strong>Private organization draft</strong>
              <p>
                Saving does not publish this Project or Challenge, issue an
                invitation, or start an application workflow.
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
          {saveState.projectId ? (
            <a
              className="profile-public-link"
              href={privateCompanyProjectPath(saveState.projectId)}
            >
              Continue with saved private project{" "}
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </form>
        <aside className="profile-aside">
          <section
            className="profile-checklist"
            aria-labelledby="project-checklist-title"
          >
            <p className="profile-kicker">Completion guidance</p>
            <h2 id="project-checklist-title">
              Publish only an informed decision context
            </h2>
            <ul>
              <li data-complete={initialProject.requiredSkills.length > 0}>
                <span aria-hidden="true">
                  {initialProject.requiredSkills.length > 0 ? "✓" : "○"}
                </span>
                Canonical required skills
              </li>
              <li data-complete={Boolean(initialProject.timeboxHours)}>
                <span aria-hidden="true">
                  {initialProject.timeboxHours ? "✓" : "○"}
                </span>
                Bounded timebox and deliverables
              </li>
              <li data-complete={initialProject.ownershipTerms.length >= 10}>
                <span aria-hidden="true">
                  {initialProject.ownershipTerms.length >= 10 ? "✓" : "○"}
                </span>
                Explicit ownership and compensation
              </li>
              <li
                data-complete={initialProject.expectedResponseTime.length >= 5}
              >
                <span aria-hidden="true">
                  {initialProject.expectedResponseTime.length >= 5 ? "✓" : "○"}
                </span>
                Visible response expectation
              </li>
            </ul>
          </section>
          {projectId ? (
            <LifecycleControls
              context={context}
              projectId={projectId}
              project={initialProject}
            />
          ) : (
            <ProjectPreview project={initialProject} state="draft" />
          )}
          <ProjectPreview
            project={initialProject}
            state={initialProject.state}
          />
        </aside>
      </div>
    </AuthShell>
  );
}

export function NewCompanyProjectEditor({
  organizationId,
  activeCompanyContext,
  canEdit,
  canPublish,
}: Readonly<{
  organizationId: string;
  activeCompanyContext: boolean;
  canEdit: boolean;
  canPublish: boolean;
}>) {
  return (
    <CompanyProjectEditor
      context={{
        project: emptyCompanyProject(organizationId),
        publication: null,
        activeCompanyContext,
        canEdit,
        canPublish,
      }}
    />
  );
}
