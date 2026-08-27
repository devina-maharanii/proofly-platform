"use client";

/** Design: Evidence Ledger Editorial — a dense, calm authoring ledger that makes version source, status, scope, visibility, and next action explicit. */
import { useActionState, useMemo, useState } from "react";

import {
  saveProjectRubricAction,
  transitionProjectRubricAction,
} from "@/lib/rubric/actions";
import { rubricTemplateFor, rubricTemplates } from "@/lib/rubric/templates";
import {
  initialRubricActionState,
  isImmutableRubricVersion,
  rubricDescriptorLevelLabel,
  rubricDescriptorLevels,
  rubricFeedbackVisibilityLabel,
  rubricFeedbackVisibilities,
  rubricStateLabel,
  type ProjectRubric,
  type RubricCalibrationExampleInput,
  type RubricDescriptorLevel,
  type RubricDimensionInput,
  type RubricInput,
  type RubricState,
} from "@/lib/rubric/types";

type EditableDimension = RubricDimensionInput;

const emptyDimension = (): EditableDimension => ({
  name: "",
  description: "",
  skillKeys: ["technical-communication"],
  weight: 1,
  priority: "important",
  observableCriteria: [""],
  evidenceExamples: [],
  commonFailureModes: [],
  reviewerGuidance: "",
  feedbackVisibility: "talent_and_company",
  descriptors: rubricDescriptorLevels.map(level => ({
    level,
    description: "",
  })),
});

const emptyCalibration = (): RubricCalibrationExampleInput => ({
  title: "",
  description: "",
  sourceUrl: "",
  reviewerGuidance: "",
});

function initialInput(
  projectTitle: string,
  rubric: ProjectRubric
): RubricInput {
  const version = rubric.currentVersion;
  return version
    ? {
        title: version.title,
        projectContext: version.projectContext,
        templateKey: version.templateKey,
        dimensions: version.dimensions.map(dimension => ({
          name: dimension.name,
          description: dimension.description,
          skillKeys: dimension.skillKeys,
          weight: dimension.weight,
          priority: dimension.priority,
          observableCriteria: dimension.observableCriteria,
          evidenceExamples: dimension.evidenceExamples,
          commonFailureModes: dimension.commonFailureModes,
          reviewerGuidance: dimension.reviewerGuidance,
          feedbackVisibility: dimension.feedbackVisibility,
          descriptors: dimension.descriptors,
        })),
        calibrationExamples: version.calibrationExamples.map(example => ({
          title: example.title,
          description: example.description,
          sourceUrl: example.sourceUrl,
          reviewerGuidance: example.reviewerGuidance,
        })),
      }
    : rubricTemplateFor("custom-project-context", projectTitle);
}

function Status({
  message,
  status,
}: Readonly<{ message: string; status: "idle" | "success" | "error" }>) {
  return status === "idle" ? null : (
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

function lines(value: readonly string[]) {
  return value.join("\n");
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

export function RubricEditor({
  projectId,
  projectTitle,
  rubric,
}: Readonly<{
  projectId: string;
  projectTitle: string;
  rubric: ProjectRubric;
}>) {
  const [input, setInput] = useState<RubricInput>(() =>
    initialInput(projectTitle, rubric)
  );
  const [saveState, saveAction, saving] = useActionState(
    saveProjectRubricAction,
    initialRubricActionState
  );
  const [transitionState, setTransitionState] = useState(
    initialRubricActionState
  );
  const currentVersion = rubric.currentVersion;
  const historyIsImmutable = currentVersion
    ? isImmutableRubricVersion(currentVersion.state)
    : false;
  const weightTotal = useMemo(
    () =>
      input.dimensions.reduce(
        (total, dimension) => total + (Number(dimension.weight) || 0),
        0
      ),
    [input.dimensions]
  );

  const setDimension = (index: number, change: Partial<EditableDimension>) => {
    setInput(current => ({
      ...current,
      dimensions: current.dimensions.map((dimension, candidate) =>
        candidate === index ? { ...dimension, ...change } : dimension
      ),
    }));
  };
  const setDimensionLines = (
    index: number,
    field: "observableCriteria" | "evidenceExamples" | "commonFailureModes",
    value: string
  ) =>
    setDimension(index, {
      [field]: parseLines(value),
    } as Partial<EditableDimension>);
  const setDescriptor = (
    dimensionIndex: number,
    level: RubricDescriptorLevel,
    description: string
  ) => {
    const dimension = input.dimensions[dimensionIndex];
    setDimension(dimensionIndex, {
      descriptors: dimension.descriptors.map(descriptor =>
        descriptor.level === level ? { ...descriptor, description } : descriptor
      ),
    });
  };
  const chooseTemplate = (templateKey: string) =>
    setInput(rubricTemplateFor(templateKey, projectTitle));
  const addDimension = () =>
    setInput(current => ({
      ...current,
      dimensions: [...current.dimensions, emptyDimension()],
    }));
  const removeDimension = (index: number) =>
    setInput(current => ({
      ...current,
      dimensions: current.dimensions.filter(
        (_, candidate) => candidate !== index
      ),
    }));
  const addCalibration = () =>
    setInput(current => ({
      ...current,
      calibrationExamples: [...current.calibrationExamples, emptyCalibration()],
    }));
  const updateCalibration = (
    index: number,
    change: Partial<RubricCalibrationExampleInput>
  ) =>
    setInput(current => ({
      ...current,
      calibrationExamples: current.calibrationExamples.map(
        (example, candidate) =>
          candidate === index ? { ...example, ...change } : example
      ),
    }));

  const transition = async (state: RubricState) => {
    if (!rubric.id) return;
    setTransitionState({ status: "idle", message: "" });
    const result = await transitionProjectRubricAction(
      projectId,
      rubric.id,
      state
    );
    setTransitionState(result);
  };

  return (
    <div className="rubric-editor">
      <section className="rubric-ledger" aria-labelledby="rubric-ledger-title">
        <div>
          <p className="reviewer-kicker">Rubric ledger</p>
          <h2 id="rubric-ledger-title">
            {rubric.id ? rubricStateLabel[rubric.state] : "Not authored"}
          </h2>
          <p>
            {currentVersion
              ? `Current source: version ${currentVersion.versionNumber}, ${currentVersion.state.replaceAll("_", " ")}.`
              : "No private rubric version exists for this project yet."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Visibility</dt>
            <dd>Private organization authoring</dd>
          </div>
          <div>
            <dt>Historical use</dt>
            <dd>{historyIsImmutable ? "Immutable" : "Not yet locked"}</dd>
          </div>
          <div>
            <dt>Next action</dt>
            <dd>
              {rubric.id
                ? "Refine, then mark ready"
                : "Create the first private draft"}
            </dd>
          </div>
        </dl>
      </section>

      {historyIsImmutable ? (
        <section
          className="rubric-lock-notice"
          aria-label="Immutable historical version notice"
        >
          <strong>Historical version preserved.</strong> This version cannot be
          rewritten. Saving the form creates a new private draft version; any
          later review remains tied to its locked source.
        </section>
      ) : null}

      <section
        className="reviewer-expectations rubric-expectations"
        aria-labelledby="rubric-principles-title"
      >
        <p className="reviewer-kicker">Human evaluation boundary</p>
        <h2 id="rubric-principles-title">
          Explain a bounded project, not a person.
        </h2>
        <p>
          Dimensions describe observable project evidence and contextual
          feedback. They do not generate a universal score, choose a candidate,
          or make an automated decision.
        </p>
      </section>

      <form action={saveAction} className="reviewer-form rubric-form">
        <input type="hidden" name="projectId" value={projectId} readOnly />
        <input type="hidden" name="rubricId" value={rubric.id} readOnly />
        <input
          type="hidden"
          name="dimensions"
          value={JSON.stringify(input.dimensions)}
          readOnly
        />
        <input
          type="hidden"
          name="calibrationExamples"
          value={JSON.stringify(input.calibrationExamples)}
          readOnly
        />

        <section
          className="reviewer-section"
          aria-labelledby="rubric-context-title"
        >
          <div className="reviewer-section-heading">
            <p className="reviewer-kicker">01 · project context</p>
            <h2 id="rubric-context-title">
              Start from a relevant, editable structure
            </h2>
            <p>
              Templates are authoring aids. Confirm every criterion against this
              project’s requirements and acceptance criteria before publishing.
            </p>
          </div>
          <div className="reviewer-form-grid">
            <label>
              <span>Context template</span>
              <select
                name="templateKey"
                value={input.templateKey}
                onChange={event => chooseTemplate(event.target.value)}
              >
                {rubricTemplates.map(template => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </select>
              <small>
                {
                  rubricTemplates.find(
                    template => template.key === input.templateKey
                  )?.description
                }
              </small>
            </label>
            <label>
              <span>Rubric title</span>
              <input
                name="title"
                value={input.title}
                onChange={event =>
                  setInput(current => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                maxLength={120}
                required
              />
            </label>
            <label className="reviewer-span-two">
              <span>Project-specific evaluation context</span>
              <textarea
                name="projectContext"
                value={input.projectContext}
                onChange={event =>
                  setInput(current => ({
                    ...current,
                    projectContext: event.target.value,
                  }))
                }
                rows={4}
                maxLength={900}
                required
              />
              <small>
                Describe the bounded work being evaluated. Do not use identity,
                pedigree, or a universal ability claim.
              </small>
            </label>
          </div>
        </section>

        <section
          className="reviewer-section"
          aria-labelledby="rubric-dimensions-title"
        >
          <div className="reviewer-section-heading rubric-heading-row">
            <div>
              <p className="reviewer-kicker">02 · versioned dimensions</p>
              <h2 id="rubric-dimensions-title">
                Describe what a reviewer can observe
              </h2>
              <p>
                Weights must total 100. Every dimension includes a complete
                five-level descriptor set, guidance, examples, and explicit
                feedback visibility.
              </p>
            </div>
            <p className="rubric-weight-total" data-valid={weightTotal === 100}>
              Weight total: <strong>{weightTotal}/100</strong>
            </p>
          </div>
          <div className="rubric-dimension-list">
            {input.dimensions.map((dimension, index) => (
              <fieldset
                className="rubric-dimension"
                key={`${index}-${dimension.name}`}
              >
                <legend>Dimension {index + 1}</legend>
                <div className="reviewer-form-grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={dimension.name}
                      onChange={event =>
                        setDimension(index, { name: event.target.value })
                      }
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    <span>Weight</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={dimension.weight}
                      onChange={event =>
                        setDimension(index, {
                          weight: Number(event.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={dimension.priority}
                      onChange={event =>
                        setDimension(index, {
                          priority: event.target
                            .value as EditableDimension["priority"],
                        })
                      }
                    >
                      <option value="essential">Essential</option>
                      <option value="important">Important</option>
                      <option value="supporting">Supporting</option>
                    </select>
                  </label>
                  <label>
                    <span>Feedback visibility</span>
                    <select
                      value={dimension.feedbackVisibility}
                      onChange={event =>
                        setDimension(index, {
                          feedbackVisibility: event.target
                            .value as EditableDimension["feedbackVisibility"],
                        })
                      }
                    >
                      {rubricFeedbackVisibilities.map(visibility => (
                        <option key={visibility} value={visibility}>
                          {rubricFeedbackVisibilityLabel[visibility]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="reviewer-span-two">
                    <span>Contextual description</span>
                    <textarea
                      value={dimension.description}
                      onChange={event =>
                        setDimension(index, { description: event.target.value })
                      }
                      rows={3}
                      maxLength={700}
                      required
                    />
                  </label>
                  <label className="reviewer-span-two">
                    <span>
                      Observable criteria <small>One item per line</small>
                    </span>
                    <textarea
                      value={lines(dimension.observableCriteria)}
                      onChange={event =>
                        setDimensionLines(
                          index,
                          "observableCriteria",
                          event.target.value
                        )
                      }
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>
                      Evidence examples <small>One item per line</small>
                    </span>
                    <textarea
                      value={lines(dimension.evidenceExamples)}
                      onChange={event =>
                        setDimensionLines(
                          index,
                          "evidenceExamples",
                          event.target.value
                        )
                      }
                      rows={3}
                    />
                  </label>
                  <label>
                    <span>
                      Common failure modes <small>One item per line</small>
                    </span>
                    <textarea
                      value={lines(dimension.commonFailureModes)}
                      onChange={event =>
                        setDimensionLines(
                          index,
                          "commonFailureModes",
                          event.target.value
                        )
                      }
                      rows={3}
                    />
                  </label>
                  <label className="reviewer-span-two">
                    <span>Reviewer guidance</span>
                    <textarea
                      value={dimension.reviewerGuidance}
                      onChange={event =>
                        setDimension(index, {
                          reviewerGuidance: event.target.value,
                        })
                      }
                      rows={4}
                      maxLength={900}
                      required
                    />
                    <small>
                      Keep guidance explainable, evidence-based, and open to
                      multiple valid implementation paths.
                    </small>
                  </label>
                </div>
                <div
                  className="rubric-descriptor-ledger"
                  aria-label={`Descriptor levels for ${dimension.name || `dimension ${index + 1}`}`}
                >
                  <p className="reviewer-kicker">Contextual descriptors</p>
                  {rubricDescriptorLevels.map(level => {
                    const descriptor = dimension.descriptors.find(
                      candidate => candidate.level === level
                    );
                    return (
                      <label key={level}>
                        <span>{rubricDescriptorLevelLabel[level]}</span>
                        <textarea
                          value={descriptor?.description ?? ""}
                          onChange={event =>
                            setDescriptor(index, level, event.target.value)
                          }
                          rows={2}
                          maxLength={500}
                          required
                        />
                      </label>
                    );
                  })}
                </div>
                {input.dimensions.length > 1 ? (
                  <button
                    type="button"
                    className="reviewer-secondary-button"
                    onClick={() => removeDimension(index)}
                  >
                    Remove this dimension
                  </button>
                ) : null}
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            className="reviewer-secondary-button"
            onClick={addDimension}
          >
            Add dimension
          </button>
        </section>

        <section
          className="reviewer-section"
          aria-labelledby="rubric-calibration-title"
        >
          <div className="reviewer-section-heading">
            <p className="reviewer-kicker">03 · calibration</p>
            <h2 id="rubric-calibration-title">
              Capture context, not a hidden answer key
            </h2>
            <p>
              Examples can help reviewers compare interpretations. A later
              reviewer may record a private disagreement against the locked
              version; this phase does not collect scores or decisions.
            </p>
          </div>
          {input.calibrationExamples.map((example, index) => (
            <fieldset className="rubric-calibration" key={index}>
              <legend>Calibration example {index + 1}</legend>
              <div className="reviewer-form-grid">
                <label>
                  <span>Reference title</span>
                  <input
                    value={example.title}
                    onChange={event =>
                      updateCalibration(index, { title: event.target.value })
                    }
                    maxLength={140}
                  />
                </label>
                <label>
                  <span>Reference URL</span>
                  <input
                    type="url"
                    value={example.sourceUrl}
                    onChange={event =>
                      updateCalibration(index, {
                        sourceUrl: event.target.value,
                      })
                    }
                    maxLength={500}
                    placeholder="https://"
                  />
                </label>
                <label className="reviewer-span-two">
                  <span>Context</span>
                  <textarea
                    value={example.description}
                    onChange={event =>
                      updateCalibration(index, {
                        description: event.target.value,
                      })
                    }
                    rows={3}
                    maxLength={700}
                  />
                </label>
                <label className="reviewer-span-two">
                  <span>Reviewer calibration guidance</span>
                  <textarea
                    value={example.reviewerGuidance}
                    onChange={event =>
                      updateCalibration(index, {
                        reviewerGuidance: event.target.value,
                      })
                    }
                    rows={3}
                    maxLength={700}
                  />
                </label>
              </div>
              <button
                type="button"
                className="reviewer-secondary-button"
                onClick={() =>
                  setInput(current => ({
                    ...current,
                    calibrationExamples: current.calibrationExamples.filter(
                      (_, candidate) => candidate !== index
                    ),
                  }))
                }
              >
                Remove calibration example
              </button>
            </fieldset>
          ))}
          {input.calibrationExamples.length < 5 ? (
            <button
              type="button"
              className="reviewer-secondary-button"
              onClick={addCalibration}
            >
              Add calibration example
            </button>
          ) : null}
        </section>

        <div className="reviewer-form-actions">
          <button
            className="reviewer-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving private draft…"
              : historyIsImmutable
                ? "Create private next version"
                : "Save private rubric draft"}
          </button>
          <p>
            Saving does not publish criteria, assign a reviewer, or start a
            review.
          </p>
        </div>
        <Status {...saveState} />
      </form>

      {rubric.id ? (
        <section
          className="rubric-lifecycle"
          aria-labelledby="rubric-lifecycle-title"
        >
          <div>
            <p className="reviewer-kicker">Controlled lifecycle</p>
            <h2 id="rubric-lifecycle-title">
              Publish only after accountable review
            </h2>
            <p>
              Authorized company members can mark a complete draft ready. The
              active organization owner must publish or archive. Once a
              workspace enters review, the selected published version is locked
              permanently.
            </p>
          </div>
          <div className="rubric-lifecycle-actions">
            {rubric.state === "draft" ? (
              <button
                className="reviewer-secondary-button"
                type="button"
                onClick={() => transition("ready_for_review")}
              >
                Mark ready for review
              </button>
            ) : null}
            {rubric.state === "ready_for_review" && rubric.canPublish ? (
              <button
                className="reviewer-primary-button"
                type="button"
                onClick={() => transition("published")}
              >
                Publish this version
              </button>
            ) : null}
            {["draft", "ready_for_review", "published", "locked"].includes(
              rubric.state
            ) && rubric.canPublish ? (
              <button
                className="reviewer-secondary-button"
                type="button"
                onClick={() => transition("archived")}
              >
                Archive rubric
              </button>
            ) : null}
          </div>
          <Status {...transitionState} />
        </section>
      ) : null}

      {rubric.versionHistory.length ? (
        <section
          className="rubric-history"
          aria-labelledby="rubric-history-title"
        >
          <p className="reviewer-kicker">Version history</p>
          <h2 id="rubric-history-title">Source remains traceable</h2>
          <ol>
            {rubric.versionHistory.map(version => (
              <li key={version.id}>
                <span>v{version.versionNumber}</span>
                <strong>{version.title}</strong>
                <em>{version.state.replaceAll("_", " ")}</em>
                <small>
                  {version.lockedAt
                    ? `Locked ${new Date(version.lockedAt).toLocaleString()}`
                    : version.publishedAt
                      ? `Published ${new Date(version.publishedAt).toLocaleString()}`
                      : "Private draft"}
                </small>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
