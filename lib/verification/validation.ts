/**
 * Phase 29 validation: review observations are structured human statements,
 * not scores. Finalization, proof creation, appeal and revocation authority
 * are independently enforced by server/database commands.
 */
import { z } from "zod";

import {
  reviewerAttributionModes,
  revocationReasons,
  type ReviewerAttributionMode,
  type VerificationObservation,
} from "./types";

const id = z.string().uuid();
const descriptorLevel = z.enum([
  "not_demonstrated",
  "emerging",
  "working_in_context",
  "independent_in_context",
  "advanced_in_context",
]);

const observationSchema = z.object({
  rubricDimensionId: id,
  selectedDescriptorLevel: descriptorLevel,
  observation: z.string().trim().min(20).max(1400),
  sharedFeedback: z.string().trim().max(1400),
  privateNote: z.string().trim().max(1400),
});

const reviewDecisionSchema = z
  .object({
    verificationId: id,
    workspaceId: id,
    decision: z.enum(["changes_requested", "verified", "not_verified"]),
    decisionSummary: z.string().trim().min(20).max(1600),
    actionableNextSteps: z.string().trim().max(1600),
    reviewerAttributionMode: z.enum(reviewerAttributionModes),
    observations: z.array(observationSchema).min(1).max(8),
  })
  .superRefine((value, context) => {
    const seenDimensionIds = new Set<string>();
    value.observations.forEach((observation, index) => {
      if (seenDimensionIds.has(observation.rubricDimensionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["observations", index, "rubricDimensionId"],
          message: "Each rubric dimension may be observed once.",
        });
      }
      seenDimensionIds.add(observation.rubricDimensionId);
    });
    if (
      value.decision === "changes_requested" &&
      value.actionableNextSteps.trim().length < 20
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionableNextSteps"],
        message:
          "Changes requested must give the Talent actionable next steps.",
      });
    }
  });

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseObservationPayload(value: string) {
  if (value.length > 30000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseVerificationDecisionForm(formData: FormData) {
  return reviewDecisionSchema.safeParse({
    verificationId: formValue(formData, "verificationId"),
    workspaceId: formValue(formData, "workspaceId"),
    decision: formValue(formData, "decision"),
    decisionSummary: formValue(formData, "decisionSummary"),
    actionableNextSteps: formValue(formData, "actionableNextSteps"),
    reviewerAttributionMode: formValue(formData, "reviewerAttributionMode"),
    observations: parseObservationPayload(formValue(formData, "observations")),
  });
}

export type VerificationDecisionInput = z.infer<typeof reviewDecisionSchema>;

export function verificationDecisionPayload(input: VerificationDecisionInput) {
  return {
    decision: input.decision,
    decision_summary: input.decisionSummary,
    actionable_next_steps: input.actionableNextSteps,
    reviewer_attribution_mode:
      input.reviewerAttributionMode as ReviewerAttributionMode,
    observations: input.observations.map(observation => ({
      rubric_dimension_id: observation.rubricDimensionId,
      selected_descriptor_level: observation.selectedDescriptorLevel,
      observation: observation.observation,
      shared_feedback: observation.sharedFeedback,
      private_note: observation.privateNote,
    })),
  };
}

const appealSchema = z.object({
  verificationId: id,
  workspaceId: id,
  reason: z.string().trim().min(30).max(1800),
});

export function parseVerificationAppealForm(formData: FormData) {
  return appealSchema.safeParse({
    verificationId: formValue(formData, "verificationId"),
    workspaceId: formValue(formData, "workspaceId"),
    reason: formValue(formData, "reason"),
  });
}

const revocationSchema = z.object({
  verificationId: id,
  workspaceId: id,
  reason: z.enum(revocationReasons),
  note: z.string().trim().min(20).max(1600),
});

export function parseVerificationRevocationForm(formData: FormData) {
  return revocationSchema.safeParse({
    verificationId: formValue(formData, "verificationId"),
    workspaceId: formValue(formData, "workspaceId"),
    reason: formValue(formData, "reason"),
    note: formValue(formData, "note"),
  });
}

export function verificationFieldErrors(error: z.ZodError) {
  return Object.fromEntries(
    error.issues.map(issue => [issue.path.join(".") || "form", issue.message])
  );
}

export type EditableObservation = Omit<
  VerificationObservation,
  "id" | "dimensionName" | "feedbackVisibility"
>;
