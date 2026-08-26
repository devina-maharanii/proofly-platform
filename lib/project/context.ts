/** Phase 22 server-only readers: every private Project/Challenge lookup derives membership scope; public readers return approved public snapshots only and never an invitation, application, or workspace. */
import "server-only";

import { authorizeActiveContext, getRoleContext } from "@/lib/roles/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  emptyCompanyProject,
  type CompanyProject,
  type CompanyProjectContext,
  type EvaluationDimension,
  type ProjectMilestone,
  type ProjectPublication,
  type PublicProject,
} from "./types";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown, maximum = 12) {
  return Array.isArray(value)
    ? value
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, maximum)
    : [];
}

function milestones(value: unknown): ProjectMilestone[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        return [
          {
            name: text(row.name).slice(0, 100),
            description: text(row.description).slice(0, 480),
          },
        ];
      })
    : [];
}

function dimensions(value: unknown): EvaluationDimension[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const priority = numberOrNull(row.priority);
        return priority === null
          ? []
          : [{ criterion: text(row.criterion).slice(0, 280), priority }];
      })
    : [];
}

function knownType(value: unknown): CompanyProject["projectType"] {
  return value === "private_invite_only" ||
    value === "portfolio_prompt" ||
    value === "hiring_evaluation" ||
    value === "future_paid_trial"
    ? value
    : "public_challenge";
}

function knownState(value: unknown): CompanyProject["state"] {
  return value === "preview" ||
    value === "published" ||
    value === "accepting_applications" ||
    value === "paused" ||
    value === "in_progress" ||
    value === "closed" ||
    value === "archived"
    ? value
    : "draft";
}

function normalizeProject(
  row: Record<string, unknown> | null,
  fallback: CompanyProject
): CompanyProject {
  if (!row) return fallback;
  return {
    ...fallback,
    id: text(row.id),
    organizationId: text(row.organization_id, fallback.organizationId),
    publicId: text(row.public_id),
    projectType: knownType(row.project_type),
    state: knownState(row.state),
    visibility: row.visibility === "restricted" ? "restricted" : "public",
    title: text(row.title),
    oneSentenceGoal: text(row.one_sentence_goal),
    contextAndProblem: text(row.context_and_problem),
    whyItMatters: text(row.why_it_matters),
    expectedRole: text(row.expected_role),
    experienceContext: text(row.experience_context),
    requiredSkills: stringList(
      row.required_skills
    ) as CompanyProject["requiredSkills"],
    helpfulSkills: stringList(
      row.helpful_skills
    ) as CompanyProject["helpfulSkills"],
    requiredOutput: text(row.required_output),
    acceptanceCriteria: text(row.acceptance_criteria),
    submissionFormat: text(row.submission_format),
    timeboxHours: numberOrNull(row.timebox_hours),
    milestones: milestones(row.milestones),
    outOfScope: text(row.out_of_scope),
    rubricSetup: row.rubric_setup === "later" ? "later" : "defined",
    evaluationDimensions: dimensions(row.evaluation_dimensions),
    reviewMethod: text(row.review_method),
    reviewerExpectations: text(row.reviewer_expectations),
    revisionPolicy: text(row.revision_policy),
    decisionTimeline: text(row.decision_timeline),
    compensationStatus:
      row.compensation_status === "paid_defined" ||
      row.compensation_status === "unpaid_evaluation"
        ? row.compensation_status
        : "paid_to_be_agreed",
    workPurpose:
      row.work_purpose === "production_need"
        ? "production_need"
        : "evaluation_exercise",
    ownershipTerms: text(row.ownership_terms),
    dataAccessRestrictions: text(row.data_access_restrictions),
    participantLimit: numberOrNull(row.participant_limit),
    applicationDeadline: text(row.application_deadline),
    participantExpectations: text(row.participant_expectations),
    expectedResponseTime: text(row.expected_response_time),
    noProductionReuse: row.no_production_reuse === true,
    attachmentPolicy: "no_uploads_enabled",
    version: typeof row.version === "number" ? row.version : 1,
    createdAt: text(row.created_at) || null,
    updatedAt: text(row.updated_at) || null,
  };
}

function normalizePublication(
  row: Record<string, unknown> | null
): ProjectPublication | null {
  if (!row) return null;
  return {
    state: knownState(row.state),
    publicId: text(row.public_id),
    publishedAt: text(row.published_at) || null,
    updatedAt: text(row.updated_at) || null,
  };
}

export async function getNewCompanyProjectContext(): Promise<
  Pick<
    CompanyProjectContext,
    "activeCompanyContext" | "canEdit" | "canPublish"
  > & {
    organizationId: string;
  }
> {
  const [authorization, roleContext] = await Promise.all([
    authorizeActiveContext({ role: "company_member" }),
    getRoleContext(),
  ]);
  const organizationId = authorization.ok
    ? authorization.context.active?.organizationId
    : null;
  const membership = organizationId
    ? roleContext?.memberships.find(
        candidate => candidate.organizationId === organizationId
      )
    : undefined;
  const canPublish = membership?.permissions.includes("owner") ?? false;
  const canEdit =
    canPublish || membership?.permissions.includes("hiring_member") === true;
  return {
    organizationId: organizationId ?? "",
    activeCompanyContext: Boolean(membership),
    canEdit,
    canPublish,
  };
}

export async function getCompanyProjectContext(
  projectId: string
): Promise<CompanyProjectContext | null> {
  const [supabase, context] = await Promise.all([
    createServerSupabaseClient(),
    getNewCompanyProjectContext(),
  ]);
  if (!supabase || !context.activeCompanyContext || !projectId) return null;
  const { data: draft } = await supabase
    .from("company_project_drafts")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!draft) return null;
  const project = normalizeProject(
    draft as Record<string, unknown>,
    emptyCompanyProject(context.organizationId)
  );
  const { data: publication } = await supabase
    .from("company_project_publications")
    .select("state, public_id, published_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  return {
    project,
    publication: normalizePublication(
      publication as Record<string, unknown> | null
    ),
    activeCompanyContext: true,
    canEdit: context.canEdit,
    canPublish: context.canPublish,
  };
}

function publicProject(row: Record<string, unknown>): PublicProject | null {
  const state = knownState(row.state);
  if (
    state !== "published" &&
    state !== "accepting_applications" &&
    state !== "paused"
  ) {
    return null;
  }
  const publicId = text(row.public_id);
  const organizationName = text(row.organization_name);
  if (!publicId || !organizationName) return null;
  return {
    publicId,
    projectType: knownType(row.project_type),
    state,
    title: text(row.title),
    oneSentenceGoal: text(row.one_sentence_goal),
    contextAndProblem: text(row.context_and_problem),
    whyItMatters: text(row.why_it_matters),
    expectedRole: text(row.expected_role),
    experienceContext: text(row.experience_context),
    requiredSkills: stringList(
      row.required_skills
    ) as PublicProject["requiredSkills"],
    helpfulSkills: stringList(
      row.helpful_skills
    ) as PublicProject["helpfulSkills"],
    requiredOutput: text(row.required_output),
    acceptanceCriteria: text(row.acceptance_criteria),
    submissionFormat: text(row.submission_format),
    timeboxHours: numberOrNull(row.timebox_hours) ?? 0,
    milestones: milestones(row.milestones),
    outOfScope: text(row.out_of_scope),
    rubricSetup: row.rubric_setup === "later" ? "later" : "defined",
    evaluationDimensions: dimensions(row.evaluation_dimensions),
    reviewMethod: text(row.review_method),
    reviewerExpectations: text(row.reviewer_expectations),
    revisionPolicy: text(row.revision_policy),
    decisionTimeline: text(row.decision_timeline),
    compensationStatus:
      row.compensation_status === "paid_defined" ||
      row.compensation_status === "unpaid_evaluation"
        ? row.compensation_status
        : "paid_to_be_agreed",
    workPurpose:
      row.work_purpose === "production_need"
        ? "production_need"
        : "evaluation_exercise",
    ownershipTerms: text(row.ownership_terms),
    dataAccessRestrictions: text(row.data_access_restrictions),
    participantLimit: numberOrNull(row.participant_limit) ?? 0,
    applicationDeadline: text(row.application_deadline),
    participantExpectations: text(row.participant_expectations),
    expectedResponseTime: text(row.expected_response_time),
    noProductionReuse: row.no_production_reuse === true,
    attachmentPolicy: "no_uploads_enabled",
    organizationName,
    organizationSlug: text(row.organization_slug),
    publishedAt: text(row.published_at) || null,
    updatedAt: text(row.updated_at) || null,
  };
}

export async function getPublicProject(
  publicId: string
): Promise<PublicProject | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase || !/^prj_[a-f0-9]{20,40}$/.test(publicId)) return null;
  const { data, error } = await supabase.rpc("get_public_project", {
    requested_public_id: publicId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return publicProject(data as Record<string, unknown>);
}

export async function getPublicProjectSitemap() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_project_sitemap", {
    maximum_count: 5000,
  });
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const publicId = text(row.public_id);
    return /^prj_[a-f0-9]{20,40}$/.test(publicId)
      ? [{ publicId, updatedAt: text(row.updated_at) || null }]
      : [];
  });
}
