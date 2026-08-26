/** Phase 27 private reviewer readers: parse only server-authorized RPC output. */
import "server-only";

import { canonicalSkills, type CanonicalSkillKey } from "@/lib/profile/types";
import { getRoleContext } from "@/lib/roles/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  reviewerApplicationStates,
  reviewerAvailabilityStatuses,
  reviewerConflictKinds,
  reviewerConflictScopes,
  reviewerEvidenceTypes,
  type ReviewerAdminQueueItem,
  type ReviewerApplication,
  type ReviewerAvailabilityStatus,
  type ReviewerOpportunityGuard,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const nullableText = (value: unknown) =>
  typeof value === "string" ? value : null;

const knownSkillKey = (value: unknown): value is CanonicalSkillKey =>
  typeof value === "string" &&
  canonicalSkills.some(skill => skill.key === value);

function parseApplication(value: unknown): ReviewerApplication | null {
  const row = record(value);
  const state = text(row?.state);
  const profile = record(row?.profile);
  if (!row || !profile || !reviewerApplicationStates.includes(state as never)) {
    return null;
  }
  const availabilityStatus = text(profile.availability_status);
  return {
    id: text(row.id),
    state: state as ReviewerApplication["state"],
    profile: {
      displayName: text(profile.display_name),
      professionalFocus: text(profile.professional_focus),
      experienceContext: text(profile.experience_context),
      reviewExperience: text(profile.review_experience),
      timezone: text(profile.timezone),
      languages: Array.isArray(profile.languages)
        ? profile.languages.filter(
            (language): language is string => typeof language === "string"
          )
        : [],
      availabilityStatus: reviewerAvailabilityStatuses.includes(
        availabilityStatus as ReviewerAvailabilityStatus
      )
        ? (availabilityStatus as ReviewerAvailabilityStatus)
        : "unavailable",
      maxConcurrentReviews:
        typeof profile.max_concurrent_reviews === "number"
          ? profile.max_concurrent_reviews
          : 1,
      feedbackStyle: text(profile.feedback_style),
      publicBio: text(profile.public_bio),
      conflictAcknowledgedAt: nullableText(
        row.conflict_declarations_confirmed_at
      ),
      skills: Array.isArray(row.skills)
        ? row.skills.flatMap(item => {
            const skill = record(item);
            const skillKey = skill?.skill_key;
            return knownSkillKey(skillKey)
              ? [{ skillKey, expertiseContext: text(skill?.expertise_context) }]
              : [];
          })
        : [],
    },
    evidence: Array.isArray(row.evidence)
      ? row.evidence.flatMap(item => {
          const evidence = record(item);
          const evidenceType = text(evidence?.evidence_type);
          if (!reviewerEvidenceTypes.includes(evidenceType as never)) return [];
          return [
            {
              id: text(evidence?.id),
              evidenceType:
                evidenceType as ReviewerApplication["evidence"][number]["evidenceType"],
              title: text(evidence?.title),
              description: text(evidence?.description),
              sourceUrl: text(evidence?.source_url),
            },
          ];
        })
      : [],
    conflicts: Array.isArray(row.conflicts)
      ? row.conflicts.flatMap(item => {
          const conflict = record(item);
          const kind = text(conflict?.relationship_kind);
          const scope = text(conflict?.scope);
          if (
            !reviewerConflictKinds.includes(kind as never) ||
            !reviewerConflictScopes.includes(scope as never)
          ) {
            return [];
          }
          return [
            {
              id: text(conflict?.id),
              relationshipKind:
                kind as ReviewerApplication["conflicts"][number]["relationshipKind"],
              scope: scope as ReviewerApplication["conflicts"][number]["scope"],
              organizationId: nullableText(conflict?.organization_id),
              context: text(conflict?.context),
            },
          ];
        })
      : [],
    policyAgreedAt: nullableText(row.policy_agreed_at),
    policyVersion: nullableText(row.policy_version),
    resolutionNote: text(row.resolution_note),
    submittedAt: nullableText(row.submitted_at),
    updatedAt: nullableText(row.updated_at),
  };
}

export async function getReviewerApplication(): Promise<ReviewerApplication | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_reviewer_application");
  return error ? null : parseApplication(data);
}

export async function getReviewerOpportunityGuard(): Promise<ReviewerOpportunityGuard> {
  const [context, application] = await Promise.all([
    getRoleContext(),
    getReviewerApplication(),
  ]);
  if (!application) return { allowed: false, reason: "application_required" };
  if (application.state === "active" && context?.active?.role === "reviewer") {
    return { allowed: true, reason: "active_reviewer" };
  }
  if (application.state === "approved") {
    return { allowed: false, reason: "activation_required" };
  }
  if (application.state === "paused")
    return { allowed: false, reason: "paused" };
  if (application.state === "suspended") {
    return { allowed: false, reason: "suspended" };
  }
  if (application.state === "rejected")
    return { allowed: false, reason: "not_approved" };
  return { allowed: false, reason: "approval_pending" };
}

export async function getReviewerAdminQueue(): Promise<
  ReviewerAdminQueueItem[]
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_reviewer_admin_queue", {
    maximum_count: 50,
  });
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    const row = record(item);
    const state = text(row?.state);
    if (!row || !reviewerApplicationStates.includes(state as never)) return [];
    const availabilityStatus = text(row.availability_status);
    return [
      {
        id: text(row.id),
        userId: text(row.user_id),
        state: state as ReviewerAdminQueueItem["state"],
        displayName: text(row.display_name),
        professionalFocus: text(row.professional_focus),
        availabilityStatus: reviewerAvailabilityStatuses.includes(
          availabilityStatus as ReviewerAvailabilityStatus
        )
          ? (availabilityStatus as ReviewerAvailabilityStatus)
          : null,
        skillKeys: Array.isArray(row.skill_keys)
          ? row.skill_keys.filter(knownSkillKey)
          : [],
        policyAgreedAt: nullableText(row.policy_agreed_at),
        updatedAt: nullableText(row.updated_at),
      },
    ];
  });
}

export async function getReviewerAdminApplication(
  applicationId: string
): Promise<ReviewerApplication | null> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_reviewer_admin_application", {
    requested_application_id: applicationId,
  });
  return error ? null : parseApplication(data);
}
