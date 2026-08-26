/** Phase 22 validation: private drafts can remain incomplete, but canonical skill keys, fair evaluation boundaries, and publication-readiness rules are enforced before any state change. */
import { z } from "zod";

import { canonicalSkills } from "@/lib/profile/types";

import {
  compensationStatuses,
  projectTypes,
  rubricSetupStates,
  workPurposes,
  type CompanyProject,
} from "./types";

const canonicalSkillKeys = canonicalSkills.map(skill => skill.key) as [
  string,
  ...string[],
];

const limitedText = (maximum: number) => z.string().trim().max(maximum);

const protectedRequirementPattern =
  /\b(male|female|men|women|white|black|asian|muslim|christian|hindu|religion|disabled|disability|pregnant|married|single|nationality|citizenship|under\s+\d{2}|over\s+\d{2}|\d{2}\s*(?:years|yrs)\s*old)\b/i;

const hasProtectedRequirement = (value: string) =>
  protectedRequirementPattern.test(value);

const uniqueSkillList = z
  .array(z.enum(canonicalSkillKeys))
  .max(12)
  .refine(keys => new Set(keys).size === keys.length, {
    message: "Choose each canonical skill only once.",
  });

const milestoneSchema = z
  .object({
    name: limitedText(100),
    description: limitedText(480),
  })
  .strict();

const evaluationDimensionSchema = z
  .object({
    criterion: limitedText(280),
    priority: z.number().int().min(1).max(100),
  })
  .strict();

export const projectInputSchema = z
  .object({
    projectId: z.string().uuid().optional().or(z.literal("")),
    projectType: z.enum(projectTypes),
    title: limitedText(120),
    oneSentenceGoal: limitedText(280),
    contextAndProblem: limitedText(1800),
    whyItMatters: limitedText(900),
    expectedRole: limitedText(160),
    experienceContext: limitedText(500),
    requiredSkills: uniqueSkillList,
    helpfulSkills: uniqueSkillList,
    requiredOutput: limitedText(1200),
    acceptanceCriteria: limitedText(1400),
    submissionFormat: limitedText(600),
    timeboxHours: z.number().int().min(1).max(160).nullable(),
    milestones: z.array(milestoneSchema).max(8),
    outOfScope: limitedText(900),
    rubricSetup: z.enum(rubricSetupStates),
    evaluationDimensions: z.array(evaluationDimensionSchema).max(6),
    reviewMethod: limitedText(600),
    reviewerExpectations: limitedText(600),
    revisionPolicy: limitedText(600),
    decisionTimeline: limitedText(320),
    compensationStatus: z.enum(compensationStatuses),
    workPurpose: z.enum(workPurposes),
    ownershipTerms: limitedText(900),
    dataAccessRestrictions: limitedText(900),
    participantLimit: z.number().int().min(1).max(100).nullable(),
    applicationDeadline: z
      .string()
      .trim()
      .refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "Use a date in YYYY-MM-DD format.",
      }),
    participantExpectations: limitedText(900),
    expectedResponseTime: limitedText(320),
    noProductionReuse: z.boolean(),
  })
  .strict()
  .superRefine((project, context) => {
    if (
      new Set(project.requiredSkills).size !== project.requiredSkills.length ||
      new Set(project.helpfulSkills).size !== project.helpfulSkills.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiredSkills"],
        message: "Each selected canonical skill must be unique.",
      });
    }
    if (
      project.helpfulSkills.some(skill =>
        project.requiredSkills.includes(skill)
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["helpfulSkills"],
        message: "A skill cannot be both required and helpful.",
      });
    }
    const protectedFields = [
      ["contextAndProblem", project.contextAndProblem],
      ["expectedRole", project.expectedRole],
      ["experienceContext", project.experienceContext],
      ["reviewerExpectations", project.reviewerExpectations],
      [
        "evaluationDimensions",
        project.evaluationDimensions.map(item => item.criterion).join(" "),
      ],
    ] as const;
    for (const [path, value] of protectedFields) {
      if (hasProtectedRequirement(value)) {
        context.addIssue({
          code: "custom",
          path: [path],
          message:
            "Requirements and evaluation criteria cannot depend on protected characteristics.",
        });
      }
    }
    if (
      project.workPurpose === "production_need" &&
      project.compensationStatus === "unpaid_evaluation"
    ) {
      context.addIssue({
        code: "custom",
        path: ["compensationStatus"],
        message: "Production work cannot be presented as unpaid evaluation.",
      });
    }
    if (
      project.workPurpose === "evaluation_exercise" &&
      project.timeboxHours !== null &&
      project.timeboxHours > 20
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeboxHours"],
        message: "An evaluation exercise must be bounded to 20 hours or fewer.",
      });
    }
  });

export type ProjectInput = z.infer<typeof projectInputSchema>;

function jsonArray(formData: FormData, key: string): unknown[] {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw || raw.length > 12000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function integerOrNull(formData: FormData, key: string) {
  const value = text(formData, key).trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

export function parseProjectForm(formData: FormData) {
  return projectInputSchema.safeParse({
    projectId: text(formData, "projectId"),
    projectType: text(formData, "projectType"),
    title: text(formData, "title"),
    oneSentenceGoal: text(formData, "oneSentenceGoal"),
    contextAndProblem: text(formData, "contextAndProblem"),
    whyItMatters: text(formData, "whyItMatters"),
    expectedRole: text(formData, "expectedRole"),
    experienceContext: text(formData, "experienceContext"),
    requiredSkills: jsonArray(formData, "requiredSkills"),
    helpfulSkills: jsonArray(formData, "helpfulSkills"),
    requiredOutput: text(formData, "requiredOutput"),
    acceptanceCriteria: text(formData, "acceptanceCriteria"),
    submissionFormat: text(formData, "submissionFormat"),
    timeboxHours: integerOrNull(formData, "timeboxHours"),
    milestones: jsonArray(formData, "milestones"),
    outOfScope: text(formData, "outOfScope"),
    rubricSetup: text(formData, "rubricSetup"),
    evaluationDimensions: jsonArray(formData, "evaluationDimensions"),
    reviewMethod: text(formData, "reviewMethod"),
    reviewerExpectations: text(formData, "reviewerExpectations"),
    revisionPolicy: text(formData, "revisionPolicy"),
    decisionTimeline: text(formData, "decisionTimeline"),
    compensationStatus: text(formData, "compensationStatus"),
    workPurpose: text(formData, "workPurpose"),
    ownershipTerms: text(formData, "ownershipTerms"),
    dataAccessRestrictions: text(formData, "dataAccessRestrictions"),
    participantLimit: integerOrNull(formData, "participantLimit"),
    applicationDeadline: text(formData, "applicationDeadline"),
    participantExpectations: text(formData, "participantExpectations"),
    expectedResponseTime: text(formData, "expectedResponseTime"),
    noProductionReuse: text(formData, "noProductionReuse") === "true",
  });
}

export function projectReadinessIssues(project: ProjectInput | CompanyProject) {
  const issues: Record<string, string> = {};
  const add = (key: string, message: string) => {
    if (!issues[key]) issues[key] = message;
  };
  if (project.title.trim().length < 6)
    add("title", "Use a clear project title of at least 6 characters.");
  if (project.oneSentenceGoal.trim().length < 12)
    add("oneSentenceGoal", "State a concrete goal in at least 12 characters.");
  if (project.contextAndProblem.trim().length < 40)
    add(
      "contextAndProblem",
      "Explain the context and user problem in at least 40 characters."
    );
  if (project.whyItMatters.trim().length < 20)
    add("whyItMatters", "Explain why the work matters.");
  if (project.expectedRole.trim().length < 3)
    add("expectedRole", "State the expected contribution context.");
  if (project.experienceContext.trim().length < 10)
    add(
      "experienceContext",
      "State the relevant experience context without personal criteria."
    );
  if (project.requiredSkills.length === 0)
    add("requiredSkills", "Select at least one required canonical skill.");
  if (project.requiredOutput.trim().length < 10)
    add("requiredOutput", "Describe the required output.");
  if (project.acceptanceCriteria.trim().length < 20)
    add("acceptanceCriteria", "Give concrete acceptance criteria.");
  if (project.submissionFormat.trim().length < 5)
    add("submissionFormat", "State the expected submission format.");
  if (!project.timeboxHours)
    add("timeboxHours", "Give a realistic, bounded timebox in hours.");
  if (project.outOfScope.trim().length < 10)
    add("outOfScope", "State what is explicitly out of scope.");
  if (project.rubricSetup === "defined") {
    if (project.evaluationDimensions.length === 0)
      add(
        "evaluationDimensions",
        "Define at least one evaluation dimension or mark the rubric for later setup."
      );
    let total = 0;
    for (const dimension of project.evaluationDimensions) {
      total += dimension.priority;
    }
    if (project.evaluationDimensions.length > 0 && total !== 100)
      add(
        "evaluationDimensions",
        "Defined evaluation priorities must total 100."
      );
  }
  if (project.reviewMethod.trim().length < 10)
    add("reviewMethod", "Explain how work will be reviewed.");
  if (project.reviewerExpectations.trim().length < 10)
    add(
      "reviewerExpectations",
      "State reviewer expectations or review ownership."
    );
  if (project.revisionPolicy.trim().length < 10)
    add("revisionPolicy", "State the revision policy.");
  if (project.decisionTimeline.trim().length < 5)
    add("decisionTimeline", "State the decision timeline.");
  if (project.ownershipTerms.trim().length < 10)
    add("ownershipTerms", "State explicit ownership and IP terms.");
  if (project.dataAccessRestrictions.trim().length < 10)
    add("dataAccessRestrictions", "State data and access boundaries.");
  if (!project.participantLimit)
    add("participantLimit", "Set a participant limit.");
  if (!project.applicationDeadline)
    add("applicationDeadline", "Set the participation deadline.");
  if (project.applicationDeadline) {
    const deadline = new Date(`${project.applicationDeadline}T23:59:59.999Z`);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now())
      add("applicationDeadline", "Use a future participation deadline.");
  }
  if (project.participantExpectations.trim().length < 10)
    add(
      "participantExpectations",
      "State participant expectations before the project is published."
    );
  if (project.expectedResponseTime.trim().length < 5)
    add(
      "expectedResponseTime",
      "State when participants can expect a response."
    );
  if (
    project.workPurpose === "production_need" &&
    project.compensationStatus === "unpaid_evaluation"
  )
    add(
      "compensationStatus",
      "Production work needs an explicit paid compensation context."
    );
  if (
    project.workPurpose === "evaluation_exercise" &&
    !project.noProductionReuse
  )
    add(
      "noProductionReuse",
      "An evaluation exercise must explicitly prohibit production reuse and ownership transfer."
    );
  if (
    project.workPurpose === "evaluation_exercise" &&
    project.timeboxHours !== null &&
    project.timeboxHours > 20
  )
    add("timeboxHours", "An evaluation exercise cannot exceed 20 hours.");
  if (
    project.projectType === "future_paid_trial" &&
    project.compensationStatus === "unpaid_evaluation"
  )
    add(
      "compensationStatus",
      "A future paid trial must have an explicit paid compensation context."
    );
  return issues;
}

export function projectFieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );
}
