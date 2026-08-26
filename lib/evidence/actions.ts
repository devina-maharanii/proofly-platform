"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  initialWorkEvidenceActionState,
  type WorkEvidenceActionState,
} from "./types";
import {
  evidenceIdSchema,
  parseWorkEvidenceForm,
  workEvidenceFieldErrors,
} from "./validation";

const failure = (
  message: string,
  fieldErrors?: Record<string, string>
): WorkEvidenceActionState => ({ status: "error", message, fieldErrors });

const requestAddress = async () => {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
};

async function evidenceCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok) {
    return {
      ok: false as const,
      state: failure(
        "Switch to your Talent context to manage private work evidence."
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
        `Too many evidence changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase };
}

const formEvidenceId = (formData: FormData) => {
  const value = formData.get("evidenceId");
  if (typeof value !== "string" || !value) return null;
  const parsed = evidenceIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const refreshEvidence = () => {
  revalidatePath("/profile");
  revalidatePath("/profile/evidence/new");
  revalidatePath("/profile/evidence/[evidenceId]", "page");
  revalidatePath("/evidence/[publicId]", "page");
  revalidatePath("/talent/[handle]", "page");
};

export async function saveWorkEvidenceAction(
  _previousState: WorkEvidenceActionState = initialWorkEvidenceActionState,
  formData: FormData
): Promise<WorkEvidenceActionState> {
  void _previousState;
  const parsed = parseWorkEvidenceForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and try again.",
      workEvidenceFieldErrors(parsed.error)
    );
  }
  const command = await evidenceCommand();
  if (!command.ok) return command.state;
  const evidenceId = formEvidenceId(formData);
  const evidence = parsed.data;
  const { data, error } = await command.supabase.rpc("save_work_evidence", {
    requested_evidence_id: evidenceId,
    requested_evidence: {
      title: evidence.title,
      short_summary: evidence.shortSummary,
      evidence_type: evidence.evidenceType,
      problem_goal: evidence.problemGoal,
      user_role: evidence.userRole,
      personal_contribution: evidence.personalContribution,
      contribution_scope: evidence.contributionScope,
      context_constraints: evidence.contextConstraints,
      decisions_tradeoffs: evidence.decisionsTradeoffs,
      outcome_status: evidence.outcomeStatus,
      team_work: evidence.teamWork,
      ownership_status: evidence.ownershipStatus,
      permission_note: evidence.permissionNote,
      started_on: evidence.startedOn,
      duration_text: evidence.durationText,
    },
    requested_skills: evidence.skills.map(skill => ({
      skill_key: skill.skillKey,
      context: skill.context,
    })),
    requested_links: evidence.links.map(link => ({
      link_type: link.linkType,
      label: link.label,
      url: link.url,
      availability: link.availability,
      is_public: link.isPublic,
    })),
    requested_attributions: evidence.attributions.map(attribution => ({
      contributor_name: attribution.contributorName,
      contributor_role: attribution.contributorRole,
      source_reference_url: attribution.sourceReferenceUrl,
      is_public: attribution.isPublic,
    })),
  });
  if (error || !data || typeof data !== "object") {
    return failure(
      "Your private work-evidence draft could not be saved safely. Try again."
    );
  }
  const savedId =
    "id" in data && typeof data.id === "string" ? data.id : evidenceId;
  refreshEvidence();
  return {
    status: "success",
    message: "Your private evidence draft is saved as a new version.",
    evidenceId: savedId ?? undefined,
  };
}

async function lifecycleEvidenceAction(
  formData: FormData,
  action:
    "mark_work_evidence_ready" | "hide_work_evidence" | "archive_work_evidence",
  success: string
): Promise<WorkEvidenceActionState> {
  const evidenceId = formEvidenceId(formData);
  if (!evidenceId) return failure("This private evidence item is unavailable.");
  const command = await evidenceCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(action, {
    requested_evidence_id: evidenceId,
  });
  if (error) {
    return failure(
      action === "mark_work_evidence_ready"
        ? "Add a title, summary, context, personal contribution, scope, and one canonical skill before previewing. Team work also needs attribution."
        : "This evidence state could not be changed safely. Review the private draft and try again."
    );
  }
  refreshEvidence();
  return { status: "success", message: success, evidenceId };
}

export async function prepareWorkEvidencePreviewAction(
  _previousState: WorkEvidenceActionState = initialWorkEvidenceActionState,
  formData: FormData
) {
  void _previousState;
  return lifecycleEvidenceAction(
    formData,
    "mark_work_evidence_ready",
    "Your evidence is ready for a private preview. Publishing remains a separate choice."
  );
}

export async function publishWorkEvidenceAction(
  _previousState: WorkEvidenceActionState = initialWorkEvidenceActionState,
  formData: FormData
): Promise<WorkEvidenceActionState> {
  void _previousState;
  const evidenceId = formEvidenceId(formData);
  const visibility = formData.get("visibility");
  if (
    !evidenceId ||
    (visibility !== "published" && visibility !== "unlisted")
  ) {
    return failure("Choose a valid evidence visibility before publishing.");
  }
  if (formData.get("confirmPublicEvidence") !== "confirmed") {
    return failure(
      "Review the public fields and confirm before publishing evidence."
    );
  }
  const command = await evidenceCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc("publish_work_evidence", {
    requested_evidence_id: evidenceId,
    requested_visibility: visibility,
    acknowledged_public_fields: true,
  });
  if (error) {
    return failure(
      "This evidence could not be published safely. Check ownership, attribution, and visibility before trying again."
    );
  }
  refreshEvidence();
  return {
    status: "success",
    message:
      visibility === "published"
        ? "This evidence is published with its selected public fields."
        : "This evidence is unlisted. Anyone with its direct link can view the selected public fields.",
    evidenceId,
  };
}

export async function hideWorkEvidenceAction(
  _previousState: WorkEvidenceActionState = initialWorkEvidenceActionState,
  formData: FormData
) {
  void _previousState;
  return lifecycleEvidenceAction(
    formData,
    "hide_work_evidence",
    "This evidence is private. Its public snapshot is no longer available."
  );
}

export async function archiveWorkEvidenceAction(
  _previousState: WorkEvidenceActionState = initialWorkEvidenceActionState,
  formData: FormData
) {
  void _previousState;
  return lifecycleEvidenceAction(
    formData,
    "archive_work_evidence",
    "This evidence is archived and removed from active public presentation."
  );
}
