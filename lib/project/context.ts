/** Phase 22 server-only readers: every private Project/Challenge lookup derives membership scope; public readers return approved public snapshots only and never an invitation, application, or workspace. */
import "server-only";

import { headers } from "next/headers";

import { authorizeActiveContext, getRoleContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  emptyCompanyProject,
  type CompanyProject,
  type CompanyProjectContext,
  type EvaluationDimension,
  type ProjectDiscoveryFilters,
  type ProjectDiscoveryItem,
  type ProjectDiscoveryResult,
  type ProjectMilestone,
  type ProjectPublication,
  type PublicProject,
  type RecentProjectSearch,
} from "./types";
import {
  discoveryFilterPayload,
  type ProjectDiscoveryUrlState,
} from "./discovery";

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

type DiscoveryCursor = Readonly<{
  rank: number;
  updatedAt: string;
  publicId: string;
}>;

function parseDiscoveryCursor(value: string): DiscoveryCursor | null {
  if (!value || value.length > 420) return null;
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const rank = numberOrNull(parsed.rank);
    const updatedAt = text(parsed.updated_at);
    const publicId = text(parsed.public_id);
    return rank === null ||
      !updatedAt ||
      !/^prj_[a-f0-9]{20,40}$/.test(publicId)
      ? null
      : { rank, updatedAt, publicId };
  } catch {
    return null;
  }
}

function createDiscoveryCursor(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const rank = numberOrNull(row.rank);
  const updatedAt = text(row.updated_at);
  const publicId = text(row.public_id);
  if (rank === null || !updatedAt || !/^prj_[a-f0-9]{20,40}$/.test(publicId)) {
    return null;
  }
  return Buffer.from(
    JSON.stringify({ rank, updated_at: updatedAt, public_id: publicId })
  ).toString("base64url");
}

function discoveryReasons(
  row: Record<string, unknown>,
  filters: ProjectDiscoveryFilters
) {
  const requiredSkills = stringList(row.required_skills);
  const reasons: string[] = [];
  if (filters.query) reasons.push("Matches your text search");
  if (filters.skill) {
    reasons.push(
      requiredSkills.includes(filters.skill)
        ? "Lists your selected skill as required"
        : "Lists your selected skill as helpful"
    );
  }
  if (filters.skillFamily) reasons.push("Matches the selected skill family");
  if (filters.projectType) reasons.push("Matches the selected project type");
  if (filters.timebox) reasons.push("Fits the selected timebox");
  if (filters.compensation) reasons.push("Matches the compensation filter");
  if (filters.workMode !== "any") reasons.push("Matches the work-mode filter");
  if (filters.timezone) reasons.push("Matches the timezone-overlap filter");
  if (filters.deadline !== "any") reasons.push("Fits the deadline window");
  if (filters.companySize) reasons.push("Matches the company-size filter");
  if (reasons.length === 0) {
    reasons.push(
      filters.sort === "newest"
        ? "Ordered by most recently updated public context"
        : "Ordered by public context relevance and freshness"
    );
  }
  return reasons.slice(0, 3);
}

function discoveryItem(
  row: Record<string, unknown>,
  filters: ProjectDiscoveryFilters
): ProjectDiscoveryItem | null {
  const publicId = text(row.public_id);
  const state = text(row.state);
  const projectType = knownType(row.project_type);
  if (
    !/^prj_[a-f0-9]{20,40}$/.test(publicId) ||
    (state !== "published" && state !== "accepting_applications") ||
    projectType === "private_invite_only"
  ) {
    return null;
  }
  return {
    publicId,
    projectType,
    state,
    title: text(row.title),
    oneSentenceGoal: text(row.one_sentence_goal),
    requiredSkills: stringList(
      row.required_skills
    ) as ProjectDiscoveryItem["requiredSkills"],
    helpfulSkills: stringList(
      row.helpful_skills
    ) as ProjectDiscoveryItem["helpfulSkills"],
    timeboxHours: numberOrNull(row.timebox_hours) ?? 0,
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
    applicationDeadline: text(row.application_deadline),
    experienceContext: text(row.experience_context),
    organizationName: text(row.organization_name),
    organizationSlug: text(row.organization_slug),
    companySize: text(row.company_size),
    timezoneOverlap: text(row.timezone_overlap),
    workLocationPreference: text(row.work_location_preference),
    publishedAt: text(row.published_at) || null,
    updatedAt: text(row.updated_at) || null,
    relevance: numberOrNull(row.relevance) ?? 0,
    matchReasons: discoveryReasons(row, filters),
  };
}

async function discoveryRequestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

export async function getPublicProjectDiscovery(
  search: ProjectDiscoveryUrlState
): Promise<ProjectDiscoveryResult> {
  const session = await getVerifiedAuthSession();
  const limit = securityRateLimiter.check(
    "search",
    session?.userId ?? "anonymous",
    await discoveryRequestAddress()
  );
  if (!limit.ok) {
    return {
      items: [],
      nextCursor: null,
      rateLimitedForSeconds: limit.retryAfterSeconds,
    };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase)
    return { items: [], nextCursor: null, rateLimitedForSeconds: null };
  const cursor = parseDiscoveryCursor(search.cursor);
  if (search.cursor && !cursor) {
    return { items: [], nextCursor: null, rateLimitedForSeconds: null };
  }
  const { data, error } = await supabase.rpc("get_public_project_discovery", {
    requested_query: search.query,
    requested_filters: discoveryFilterPayload(search),
    requested_cursor_rank: cursor?.rank ?? null,
    requested_cursor_updated_at: cursor?.updatedAt ?? null,
    requested_cursor_public_id: cursor?.publicId ?? null,
    requested_limit: 12,
    requested_saved_only: search.savedOnly,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { items: [], nextCursor: null, rateLimitedForSeconds: null };
  }
  const row = data as Record<string, unknown>;
  const items = Array.isArray(row.items)
    ? row.items
        .flatMap(item =>
          item && typeof item === "object" && !Array.isArray(item)
            ? [discoveryItem(item as Record<string, unknown>, search)]
            : []
        )
        .filter((item): item is ProjectDiscoveryItem => item !== null)
    : [];
  return {
    items,
    nextCursor: createDiscoveryCursor(row.next_cursor),
    rateLimitedForSeconds: null,
  };
}

export async function getTalentSavedProjectIds() {
  const authorization = await authorizeActiveContext({ role: "talent" });
  const supabase = await createServerSupabaseClient();
  if (!authorization.ok || !supabase) return [];
  const { data, error } = await supabase.rpc("get_talent_saved_project_ids", {
    maximum_count: 100,
  });
  return error || !Array.isArray(data)
    ? []
    : data.filter(
        (value): value is string =>
          typeof value === "string" && /^prj_[a-f0-9]{20,40}$/.test(value)
      );
}

export async function getTalentRecentProjectSearches(): Promise<
  RecentProjectSearch[]
> {
  const authorization = await authorizeActiveContext({ role: "talent" });
  const supabase = await createServerSupabaseClient();
  if (!authorization.ok || !supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_talent_recent_project_searches",
    { maximum_count: 8 }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const filters =
      row.filters &&
      typeof row.filters === "object" &&
      !Array.isArray(row.filters)
        ? (row.filters as Partial<ProjectDiscoveryFilters>)
        : {};
    return [
      {
        query: text(row.query).slice(0, 160),
        filters,
        lastUsedAt: text(row.last_used_at) || null,
      },
    ];
  });
}
