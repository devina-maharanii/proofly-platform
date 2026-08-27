/** Phase 33 validation: proposal, negotiation, submission, access, dispute, and resolution payloads are bounded before protected RPC commands re-authorize them. */
import { z } from "zod";

import { engagementTypes, type EngagementType } from "./types";

const uuid = z.string().uuid();
const compact = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

const integerText = z.string().regex(/^\d+$/);

const proposalFields = z
  .object({
    applicationId: uuid,
    engagementType: z.enum(engagementTypes),
    parentEngagementId: z
      .union([uuid, z.literal("")])
      .transform(value => value || null),
    marketCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2,8}$/),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    summary: compact(20, 600),
    scope: compact(30, 1800),
    deliverables: compact(20, 1800),
    exclusions: compact(10, 900),
    dependencies: z.string().trim().max(900),
    assumptions: z.string().trim().max(900),
    startDate: z.string().date(),
    deadline: z.string().date(),
    expectedEffortHours: z.string().regex(/^[1-9][0-9]{0,3}$/),
    timezone: compact(1, 80),
    communicationCadence: compact(5, 240),
    compensationAmountMinor: z.string().regex(/^[1-9][0-9]{0,14}$/),
    platformFeeMinor: integerText.max(14),
    taxesAndFeesNote: compact(10, 600),
    paymentTrigger: z.enum(["milestone_accepted", "engagement_completed"]),
    paymentCadence: z.enum(["per_milestone", "weekly", "biweekly", "monthly"]),
    acceptanceCriteria: compact(20, 1800),
    revisionAllowance: z.string().regex(/^[0-8]$/),
    approvedTools: z.string().trim().max(600),
    confidentialityTerms: compact(10, 1200),
    ownershipTerms: compact(10, 1200),
    licenseTerms: compact(10, 1200),
    portfolioVisibility: z.enum([
      "private_until_explicit_consent",
      "not_permitted",
    ]),
    cancellationTerms: compact(20, 1200),
    terminationTerms: compact(20, 1200),
    disputeTerms: compact(20, 1200),
    supportRoute: compact(3, 240),
    marketLimitationNotice: compact(20, 900),
    milestoneTitle: compact(3, 160),
    milestoneDescription: compact(10, 1400),
    milestoneDeliverableType: compact(3, 120),
    milestoneDefinitionOfDone: compact(20, 1600),
    milestoneDueDate: z.string().date(),
    milestoneAmountMinor: z.string().regex(/^[1-9][0-9]{0,14}$/),
    milestoneRevisionAllowance: z.string().regex(/^[0-8]$/),
    milestoneTimeoutPolicy: compact(10, 360),
    milestoneEvidencePolicy: compact(10, 600),
  })
  .superRefine((data, context) => {
    if (data.startDate > data.deadline) {
      context.addIssue({
        code: "custom",
        message: "Deadline must follow the start date.",
      });
    }
    if (
      data.milestoneDueDate < data.startDate ||
      data.milestoneDueDate > data.deadline
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The milestone due date must fall within the engagement schedule.",
      });
    }
    if (data.compensationAmountMinor !== data.milestoneAmountMinor) {
      context.addIssue({
        code: "custom",
        message: "Compensation must exactly equal the stated milestone amount.",
      });
    }
    if (
      data.engagementType === "paid_trial" &&
      (Number(data.expectedEffortHours) > 160 ||
        data.paymentCadence !== "per_milestone")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A paid trial is one paid milestone, up to 160 hours, with per-milestone funding.",
      });
    }
    if (
      data.engagementType === "ongoing_contract" &&
      data.paymentCadence === "per_milestone"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "An ongoing contract requires a recurring cadence rather than per-milestone cadence.",
      });
    }
  });

export type EngagementProposalInput = z.infer<typeof proposalFields>;

export const parseEngagementProposalForm = (formData: FormData) =>
  proposalFields.safeParse({
    applicationId: formData.get("applicationId"),
    engagementType: formData.get("engagementType"),
    parentEngagementId: formData.get("parentEngagementId"),
    marketCode: formData.get("marketCode"),
    currency: formData.get("currency"),
    summary: formData.get("summary"),
    scope: formData.get("scope"),
    deliverables: formData.get("deliverables"),
    exclusions: formData.get("exclusions"),
    dependencies: formData.get("dependencies"),
    assumptions: formData.get("assumptions"),
    startDate: formData.get("startDate"),
    deadline: formData.get("deadline"),
    expectedEffortHours: formData.get("expectedEffortHours"),
    timezone: formData.get("timezone"),
    communicationCadence: formData.get("communicationCadence"),
    compensationAmountMinor: formData.get("compensationAmountMinor"),
    platformFeeMinor: formData.get("platformFeeMinor"),
    taxesAndFeesNote: formData.get("taxesAndFeesNote"),
    paymentTrigger: formData.get("paymentTrigger"),
    paymentCadence: formData.get("paymentCadence"),
    acceptanceCriteria: formData.get("acceptanceCriteria"),
    revisionAllowance: formData.get("revisionAllowance"),
    approvedTools: formData.get("approvedTools"),
    confidentialityTerms: formData.get("confidentialityTerms"),
    ownershipTerms: formData.get("ownershipTerms"),
    licenseTerms: formData.get("licenseTerms"),
    portfolioVisibility: formData.get("portfolioVisibility"),
    cancellationTerms: formData.get("cancellationTerms"),
    terminationTerms: formData.get("terminationTerms"),
    disputeTerms: formData.get("disputeTerms"),
    supportRoute: formData.get("supportRoute"),
    marketLimitationNotice: formData.get("marketLimitationNotice"),
    milestoneTitle: formData.get("milestoneTitle"),
    milestoneDescription: formData.get("milestoneDescription"),
    milestoneDeliverableType: formData.get("milestoneDeliverableType"),
    milestoneDefinitionOfDone: formData.get("milestoneDefinitionOfDone"),
    milestoneDueDate: formData.get("milestoneDueDate"),
    milestoneAmountMinor: formData.get("milestoneAmountMinor"),
    milestoneRevisionAllowance: formData.get("milestoneRevisionAllowance"),
    milestoneTimeoutPolicy: formData.get("milestoneTimeoutPolicy"),
    milestoneEvidencePolicy: formData.get("milestoneEvidencePolicy"),
  });

export const parseEngagementNegotiationForm = (formData: FormData) =>
  z
    .object({
      engagementId: uuid,
      entryType: z.enum([
        "question",
        "change_requested",
        "response",
        "declined",
      ]),
      body: compact(10, 1600),
    })
    .safeParse({
      engagementId: formData.get("engagementId"),
      entryType: formData.get("entryType"),
      body: formData.get("body"),
    });

export const parseEngagementIdForm = (formData: FormData) =>
  z
    .object({ engagementId: uuid })
    .safeParse({ engagementId: formData.get("engagementId") });

export const parseMilestoneSubmissionForm = (formData: FormData) =>
  z
    .object({
      engagementId: uuid,
      milestoneId: uuid,
      workspaceSubmissionVersionId: uuid,
      summary: compact(10, 1000),
      knownLimitations: z.string().trim().max(1400),
    })
    .safeParse({
      engagementId: formData.get("engagementId"),
      milestoneId: formData.get("milestoneId"),
      workspaceSubmissionVersionId: formData.get(
        "workspaceSubmissionVersionId"
      ),
      summary: formData.get("summary"),
      knownLimitations: formData.get("knownLimitations"),
    });

export const parseMilestoneDecisionForm = (formData: FormData) =>
  z
    .object({
      engagementId: uuid,
      milestoneId: uuid,
      decision: z.enum([
        "changes_requested",
        "accepted_for_payment",
        "dispute_raised",
      ]),
      rationale: compact(20, 1600),
    })
    .safeParse({
      engagementId: formData.get("engagementId"),
      milestoneId: formData.get("milestoneId"),
      decision: formData.get("decision"),
      rationale: formData.get("rationale"),
    });

export const parseAccessRequestForm = (formData: FormData) =>
  z
    .object({
      engagementId: uuid,
      accessKind: z.enum([
        "repository",
        "staging_environment",
        "documentation",
        "sandbox_data",
        "other_non_production",
      ]),
      resourceLabel: compact(3, 240),
      purpose: compact(10, 600),
      expiresAt: z.string().refine(value => !Number.isNaN(Date.parse(value)), {
        message: "Expiry must be a valid date and time.",
      }),
    })
    .safeParse({
      engagementId: formData.get("engagementId"),
      accessKind: formData.get("accessKind"),
      resourceLabel: formData.get("resourceLabel"),
      purpose: formData.get("purpose"),
      expiresAt: formData.get("expiresAt"),
    });

export const parseAccessGrantForm = (formData: FormData) =>
  z
    .object({ accessGrantId: uuid })
    .safeParse({ accessGrantId: formData.get("accessGrantId") });

export const parseEngagementReasonForm = (formData: FormData) =>
  z.object({ engagementId: uuid, reason: compact(20, 900) }).safeParse({
    engagementId: formData.get("engagementId"),
    reason: formData.get("reason"),
  });

export const parseDisputeForm = (formData: FormData) =>
  z
    .object({
      engagementId: uuid,
      milestoneId: z
        .union([uuid, z.literal("")])
        .transform(value => value || null),
      category: z.enum([
        "scope_creep",
        "harassment",
        "unsafe_instruction",
        "suspected_unpaid_work",
        "payment_dependency",
        "access_safety",
        "quality_or_acceptance",
        "other",
      ]),
      reason: compact(30, 1800),
      requestedRemedy: compact(20, 1200),
    })
    .safeParse({
      engagementId: formData.get("engagementId"),
      milestoneId: formData.get("milestoneId"),
      category: formData.get("category"),
      reason: formData.get("reason"),
      requestedRemedy: formData.get("requestedRemedy"),
    });

export const parseDisputeResolutionForm = (formData: FormData) =>
  z
    .object({
      disputeId: uuid,
      outcome: z.enum([
        "returned_to_parties",
        "terminated_with_hold",
        "cancelled_before_start",
        "escalated_to_payment_provider",
        "no_platform_action",
      ]),
      resolutionSummary: compact(30, 1800),
    })
    .safeParse({
      disputeId: formData.get("disputeId"),
      outcome: formData.get("outcome"),
      resolutionSummary: formData.get("resolutionSummary"),
    });

export const buildEngagementTermsSnapshot = (
  input: EngagementProposalInput
) => ({
  summary: input.summary,
  scope: input.scope,
  deliverables: input.deliverables,
  exclusions: input.exclusions,
  dependencies: input.dependencies,
  assumptions: input.assumptions,
  start_date: input.startDate,
  deadline: input.deadline,
  expected_effort_hours: input.expectedEffortHours,
  timezone: input.timezone,
  communication_cadence: input.communicationCadence,
  compensation_amount_minor: input.compensationAmountMinor,
  currency: input.currency,
  platform_fee_minor: input.platformFeeMinor,
  taxes_and_fees_note: input.taxesAndFeesNote,
  payment_trigger: input.paymentTrigger,
  payment_cadence: input.paymentCadence,
  funding_requirement: "provider_verified_before_work",
  acceptance_criteria: input.acceptanceCriteria,
  revision_allowance: input.revisionAllowance,
  access_terms: {
    production_access: "blocked",
    personal_credentials: "prohibited",
    approved_tools: input.approvedTools,
  },
  confidentiality_terms: input.confidentialityTerms,
  ownership_terms: input.ownershipTerms,
  license_terms: input.licenseTerms,
  portfolio_visibility: input.portfolioVisibility,
  cancellation_terms: input.cancellationTerms,
  termination_terms: input.terminationTerms,
  dispute_terms: input.disputeTerms,
  support_route: input.supportRoute,
  market_code: input.marketCode,
  market_limitation_notice: input.marketLimitationNotice,
  milestones: [
    {
      title: input.milestoneTitle,
      description: input.milestoneDescription,
      deliverable_type: input.milestoneDeliverableType,
      definition_of_done: input.milestoneDefinitionOfDone,
      due_date: input.milestoneDueDate,
      amount_minor: input.milestoneAmountMinor,
      currency: input.currency,
      revision_allowance: input.milestoneRevisionAllowance,
      approver_role: "company",
      timeout_policy: input.milestoneTimeoutPolicy,
      evidence_policy: input.milestoneEvidencePolicy,
      linked_task_ids: [],
    },
  ],
});

export const isEngagementType = (value: string): value is EngagementType =>
  (engagementTypes as readonly string[]).includes(value);
