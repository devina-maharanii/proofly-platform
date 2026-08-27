/**
 * Evidence Ledger Editorial — Phase 29 reads one exact private verification
 * record. This server-only parser preserves actor-specific redaction, never
 * infers scores, and never exposes reviewer-private notes outside their guard.
 */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type { CanonicalSkillKey } from "@/lib/profile/types";
import type {
  RubricDescriptorLevel,
  RubricFeedbackVisibility,
} from "@/lib/rubric/types";

import {
  verificationStates,
  type AdminVerificationQueueItem,
  type TalentEvidencePublicationChoice,
  type VerificationRecord,
  type VerificationReviewerCandidate,
  type VerificationReview,
  type VerificationState,
} from "./types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asNullableText = (value: unknown) =>
  typeof value === "string" ? value : null;

const uuid = (value: unknown) => {
  const candidate = asText(value);
  return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : "";
};

const knownState = (value: unknown): VerificationState | null => {
  const candidate = asText(value);
  return verificationStates.includes(candidate as VerificationState)
    ? (candidate as VerificationState)
    : null;
};

const knownReviewState = (
  value: unknown
): VerificationReview["state"] | null => {
  const candidate = asText(value);
  return [
    "assigned",
    "under_review",
    "changes_requested",
    "verified",
    "not_verified",
    "superseded",
  ].includes(candidate)
    ? (candidate as VerificationReview["state"])
    : null;
};

const knownDescriptor = (value: unknown): RubricDescriptorLevel | null => {
  const candidate = asText(value);
  return [
    "not_demonstrated",
    "emerging",
    "working_in_context",
    "independent_in_context",
    "advanced_in_context",
  ].includes(candidate)
    ? (candidate as RubricDescriptorLevel)
    : null;
};

const knownVisibility = (value: unknown): RubricFeedbackVisibility => {
  const candidate = asText(value);
  return candidate === "company_only" || candidate === "reviewer_private"
    ? candidate
    : "talent_and_company";
};

const skillKeys = (value: unknown): CanonicalSkillKey[] =>
  Array.isArray(value)
    ? (value
        .filter(item => typeof item === "string")
        .slice(0, 8) as CanonicalSkillKey[])
    : [];

function observation(
  value: unknown
): VerificationReview["observations"][number] | null {
  const row = asRecord(value);
  const rubricDimensionId = uuid(row?.rubric_dimension_id);
  const selectedDescriptorLevel = knownDescriptor(
    row?.selected_descriptor_level
  );
  if (!row || !rubricDimensionId || !selectedDescriptorLevel) return null;
  return {
    id: rubricDimensionId,
    rubricDimensionId,
    dimensionName: "",
    selectedDescriptorLevel,
    observation: asText(row.observation).slice(0, 1400),
    sharedFeedback: asText(row.shared_feedback).slice(0, 1400),
    privateNote: asText(row.private_note).slice(0, 1400),
    feedbackVisibility: knownVisibility(row.feedback_visibility),
  };
}

function review(value: unknown): VerificationReview | null {
  const row = asRecord(value);
  const id = uuid(row?.id);
  const state = knownReviewState(row?.state);
  if (!row || !id || !state) return null;
  const observations = Array.isArray(row.observations)
    ? row.observations.flatMap(item => {
        const parsed = observation(item);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    id,
    reviewerUserId: uuid(row.reviewer_user_id) || null,
    state,
    isAppealReview: row.is_appeal_review === true,
    assignedAt: asNullableText(row.assigned_at),
    startedAt: asNullableText(row.started_at),
    decidedAt: asNullableText(row.decided_at),
    reviewerAttributionMode:
      row.reviewer_attribution_mode === "display_name"
        ? "display_name"
        : "withhold_name",
    decisionSummary: asText(row.decision_summary).slice(0, 1600),
    actionableNextSteps: asText(row.actionable_next_steps).slice(0, 1600),
    observations,
  };
}

function verification(value: unknown): VerificationRecord | null {
  const row = asRecord(value);
  const id = uuid(row?.id);
  const workspaceId = uuid(row?.workspace_id);
  const submissionId = uuid(row?.submission_id);
  const submissionVersionId = uuid(row?.submission_version_id);
  const rubricVersionId = uuid(row?.rubric_version_id);
  const talentUserId = uuid(row?.talent_user_id);
  const state = knownState(row?.state);
  if (
    !row ||
    !id ||
    !workspaceId ||
    !submissionId ||
    !submissionVersionId ||
    !rubricVersionId ||
    !talentUserId ||
    !state
  ) {
    return null;
  }
  const reviews = Array.isArray(row.reviews)
    ? row.reviews.flatMap(item => {
        const parsed = review(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const latestReview = reviews.at(-1) ?? null;
  const appeal = asRecord(row.appeal);
  const proof = asRecord(row.proof);
  return {
    id,
    workspaceId,
    submissionId,
    submissionVersionId,
    submissionVersionNumber: 0,
    rubricVersionId,
    rubricVersionNumber: 0,
    projectTitle: "",
    state,
    talentUserId,
    assignment: latestReview
      ? {
          reviewerUserId: latestReview.reviewerUserId ?? "",
          assignedAt: latestReview.assignedAt,
          acceptedAt: latestReview.startedAt,
          reviewerAttributionMode: latestReview.reviewerAttributionMode,
        }
      : null,
    reviews,
    observations: latestReview?.observations ?? [],
    decision: latestReview?.decidedAt
      ? {
          decidedAt: latestReview.decidedAt,
          decisionSummary: latestReview.decisionSummary,
          actionableNextSteps: latestReview.actionableNextSteps,
          verifiedSkillKeys: skillKeys(proof?.skill_keys),
          verificationExpiresAt: asNullableText(proof?.expires_at),
          accountableActor: "reviewer",
        }
      : null,
    appeal:
      appeal && uuid(appeal.id)
        ? {
            id: uuid(appeal.id),
            requestedAt: asNullableText(appeal.requested_at),
            reason: asText(appeal.reason).slice(0, 1800),
            state:
              appeal.state === "assigned" ||
              appeal.state === "resolved" ||
              appeal.state === "withdrawn"
                ? appeal.state
                : "requested",
            assignedReviewerUserId:
              uuid(appeal.assigned_reviewer_user_id) || null,
            resolutionSummary: asText(appeal.resolution_summary).slice(0, 1600),
          }
        : null,
    revocation:
      state === "revoked"
        ? {
            revokedAt: asNullableText(proof?.revoked_at),
            reason: null,
            publicProofRemoved: true,
          }
        : null,
    proofId: uuid(proof?.id) || null,
    proofVisibility:
      proof?.state === "public" ? "talent_approved_public" : "private",
    updatedAt: asNullableText(row.updated_at),
  };
}

export async function getWorkspaceVerification(workspaceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_workspace_verification", {
    requested_workspace_id: workspaceId,
  });
  return error ? null : verification(data);
}

export async function getVerificationReviewerCandidates(
  verificationId: string
) {
  if (!/^[0-9a-f-]{36}$/i.test(verificationId)) return [];
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_verification_reviewer_candidates",
    { requested_verification_id: verificationId }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((item): VerificationReviewerCandidate[] => {
    const row = asRecord(item);
    const userId = uuid(row?.user_id);
    const displayName = asText(row?.display_name).trim().slice(0, 120);
    return userId && displayName
      ? [{ userId, displayName, skillKeys: skillKeys(row?.skill_keys) }]
      : [];
  });
}

export async function getAdminVerificationQueue() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_admin_verification_queue");
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((item): AdminVerificationQueueItem[] => {
    const row = asRecord(item);
    const id = uuid(row?.id);
    const workspaceId = uuid(row?.workspace_id);
    const submissionVersionId = uuid(row?.submission_version_id);
    const state = knownState(row?.state);
    const appealState = row?.appeal_state;
    if (!row || !id || !workspaceId || !submissionVersionId || !state)
      return [];
    return [
      {
        id,
        workspaceId,
        state,
        submissionVersionId,
        updatedAt: asNullableText(row.updated_at),
        appealState:
          appealState === "assigned" ||
          appealState === "resolved" ||
          appealState === "withdrawn"
            ? appealState
            : appealState === "requested"
              ? "requested"
              : null,
        canRevoke: row.can_revoke === true,
      },
    ];
  });
}

export async function getTalentEvidencePublicationChoices() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("work_evidence_publications")
    .select("evidence_id, snapshot")
    .eq("state", "published")
    .limit(24);
  if (error) return [];
  return (data ?? []).flatMap((item): TalentEvidencePublicationChoice[] => {
    const evidenceId = uuid(item.evidence_id);
    const snapshot = asRecord(item.snapshot);
    const title = asText(snapshot?.title).trim().slice(0, 180);
    return evidenceId && title ? [{ evidenceId, title }] : [];
  });
}
