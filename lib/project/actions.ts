"use server";

/** Phase 22 actions: project input is validated at the server boundary, organization scope comes from active membership, and all lifecycle truth remains inside security-definer database commands. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialProjectActionState,
  initialProjectSaveActionState,
  privateCompanyProjectPath,
  publicProjectPath,
  type ProjectActionState,
  type ProjectDiscoveryFilters,
  type ProjectSaveActionState,
  type ProjectState,
} from "./types";
import {
  parseProjectForm,
  projectFieldErrors,
  type ProjectInput,
} from "./validation";

function failure(
  message: string,
  fieldErrors?: Record<string, string>
): ProjectActionState {
  return { status: "error", message, fieldErrors };
}

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function projectCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok || !authorization.context.active?.organizationId) {
    return {
      ok: false as const,
      state: failure(
        "Switch to an active company context before creating or changing a private project."
      ),
    };
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return {
      ok: false as const,
      state: failure(
        `Too many project changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase };
}

function refreshProject(projectId?: string, publicId?: string) {
  revalidatePath("/company/projects/new");
  revalidatePath("/auth/continue");
  revalidatePath("/projects/[publicId]", "page");
  revalidatePath("/sitemap.xml");
  if (projectId) revalidatePath(privateCompanyProjectPath(projectId));
  if (publicId) revalidatePath(publicProjectPath(publicId));
}

function refreshDiscovery(publicId?: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/[publicId]", "page");
  if (publicId) revalidatePath(publicProjectPath(publicId));
}

async function talentDiscoveryCommand(action: "mutation" | "search") {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase || !authorization.ok) return null;
  const limit = securityRateLimiter.check(
    action,
    session.userId,
    await requestAddress()
  );
  return limit.ok ? supabase : null;
}

export async function toggleSavedProjectAction(
  _previousState: ProjectSaveActionState = initialProjectSaveActionState,
  formData: FormData
): Promise<ProjectSaveActionState> {
  void _previousState;
  const publicId = formData.get("publicId");
  if (typeof publicId !== "string" || !/^prj_[a-f0-9]{20,40}$/.test(publicId)) {
    return { status: "error", message: "This project is unavailable to save." };
  }
  const supabase = await talentDiscoveryCommand("mutation");
  if (!supabase) {
    return {
      status: "error",
      message: "Switch to an active talent context to save a public project.",
    };
  }
  const { data, error } = await supabase.rpc("toggle_talent_saved_project", {
    requested_public_id: publicId,
  });
  if (error || typeof data !== "boolean") {
    return {
      status: "error",
      message:
        "The saved-project change could not be completed safely. Try again.",
    };
  }
  refreshDiscovery(publicId);
  return {
    status: "success",
    saved: data,
    message: data
      ? "Project saved for later review."
      : "Project removed from saved projects.",
  };
}

export async function recordRecentProjectSearchAction(
  query: string,
  filters: ProjectDiscoveryFilters
) {
  const supabase = await talentDiscoveryCommand("search");
  if (!supabase) return;
  await supabase.rpc("record_talent_project_search", {
    requested_query: query.trim().slice(0, 160),
    requested_filters: {
      skill: filters.skill,
      family: filters.skillFamily,
      level: filters.skillLevelContext,
      type: filters.projectType,
      timebox: filters.timebox,
      compensation: filters.compensation,
      mode: filters.workMode,
      timezone: filters.timezone,
      deadline: filters.deadline,
      company_size: filters.companySize,
      sort: filters.sort,
    },
  });
}

function projectPayload(project: ProjectInput) {
  return {
    project_type: project.projectType,
    title: project.title,
    one_sentence_goal: project.oneSentenceGoal,
    context_and_problem: project.contextAndProblem,
    why_it_matters: project.whyItMatters,
    expected_role: project.expectedRole,
    experience_context: project.experienceContext,
    required_skills: project.requiredSkills,
    helpful_skills: project.helpfulSkills,
    required_output: project.requiredOutput,
    acceptance_criteria: project.acceptanceCriteria,
    submission_format: project.submissionFormat,
    timebox_hours: project.timeboxHours,
    milestones: project.milestones,
    out_of_scope: project.outOfScope,
    rubric_setup: project.rubricSetup,
    evaluation_dimensions: project.evaluationDimensions,
    review_method: project.reviewMethod,
    reviewer_expectations: project.reviewerExpectations,
    revision_policy: project.revisionPolicy,
    decision_timeline: project.decisionTimeline,
    compensation_status: project.compensationStatus,
    work_purpose: project.workPurpose,
    ownership_terms: project.ownershipTerms,
    data_access_restrictions: project.dataAccessRestrictions,
    participant_limit: project.participantLimit,
    application_deadline: project.applicationDeadline,
    participant_expectations: project.participantExpectations,
    expected_response_time: project.expectedResponseTime,
    no_production_reuse: project.noProductionReuse,
  };
}

export async function saveCompanyProjectAction(
  _previousState: ProjectActionState = initialProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  void _previousState;
  const parsed = parseProjectForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and save the private draft again.",
      projectFieldErrors(parsed.error)
    );
  }
  const command = await projectCommand();
  if (!command.ok) return command.state;
  const projectId = parsed.data.projectId || null;
  const { data, error } = await command.supabase.rpc("save_company_project", {
    requested_project_id: projectId,
    requested_project: projectPayload(parsed.data),
  });
  if (error || !data || typeof data !== "object") {
    return failure(
      error?.code === "42501"
        ? "Your company context does not allow this private project change."
        : "The private project draft could not be saved safely. Review the fields and try again."
    );
  }
  const result = data as { id?: unknown; public_id?: unknown };
  const savedProjectId = typeof result.id === "string" ? result.id : undefined;
  const publicId =
    typeof result.public_id === "string" ? result.public_id : undefined;
  refreshProject(savedProjectId, publicId);
  return {
    status: "success",
    message:
      "Your private project draft is saved. It is not public or available for participation.",
    projectId: savedProjectId,
  };
}

async function lifecycleAction(
  action:
    | "prepare_company_project_preview"
    | "publish_company_project"
    | "transition_company_project",
  projectId: string,
  success: string,
  nextState?: ProjectState
): Promise<ProjectActionState> {
  const command = await projectCommand();
  if (!command.ok) return command.state;
  const args =
    action === "transition_company_project"
      ? { requested_project_id: projectId, requested_state: nextState }
      : { requested_project_id: projectId };
  const { data, error } = await command.supabase.rpc(action, args);
  if (error || !data || typeof data !== "object") {
    return failure(
      "This project state could not be changed. Review the private project requirements and your publication authority before trying again."
    );
  }
  const result = data as { public_id?: unknown };
  const publicId =
    typeof result.public_id === "string" ? result.public_id : undefined;
  refreshProject(projectId, publicId);
  return { status: "success", message: success };
}

export async function prepareCompanyProjectPreviewAction(
  _previousState: ProjectActionState = initialProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  void _previousState;
  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || !projectId) {
    return failure("Save this private project before preparing a preview.");
  }
  return lifecycleAction(
    "prepare_company_project_preview",
    projectId,
    "The project is ready for a private preview. Publication remains an owner decision."
  );
}

export async function publishCompanyProjectAction(
  _previousState: ProjectActionState = initialProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  void _previousState;
  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || !projectId) {
    return failure("Save and preview this project before publishing.");
  }
  if (formData.get("confirmProjectPublication") !== "confirmed") {
    return failure(
      "Review the scope, fairness, ownership, and compensation terms before publishing."
    );
  }
  return lifecycleAction(
    "publish_company_project",
    projectId,
    "The approved project context is now available at its stable direct address. This phase does not accept applications or messages."
  );
}

export async function transitionCompanyProjectAction(
  _previousState: ProjectActionState = initialProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  void _previousState;
  const projectId = formData.get("projectId");
  const requestedState = formData.get("requestedState");
  const acceptedStates: ProjectState[] = [
    "published",
    "accepting_applications",
    "paused",
    "in_progress",
    "closed",
    "archived",
  ];
  if (
    typeof projectId !== "string" ||
    !projectId ||
    typeof requestedState !== "string" ||
    !acceptedStates.includes(requestedState as ProjectState)
  ) {
    return failure("Choose a valid server-enforced project state.");
  }
  const currentToNextCopy: Partial<Record<ProjectState, string>> = {
    published: "The project is available at its stable direct address.",
    accepting_applications:
      "The project now states that it is accepting applications, but application submission is not built in this phase.",
    paused:
      "The project is paused; its public page is retained only as a paused context record.",
    in_progress:
      "The project is marked in progress. This phase does not create workspaces or participant access.",
    closed: "The project is closed and its public route no longer resolves.",
    archived: "The project is archived for authorized organization records.",
  };
  return lifecycleAction(
    "transition_company_project",
    projectId,
    currentToNextCopy[requestedState as ProjectState] ??
      "Project state updated.",
    requestedState as ProjectState
  );
}
