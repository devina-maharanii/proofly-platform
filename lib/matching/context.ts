/** Evidence Ledger Editorial — Phase 32 parses only guarded RPC projections; recommendation data is re-authorized by the database on every read. */
import "server-only";

import { authorizeActiveContext } from "@/lib/roles/context";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  emptyMatchingPreferences,
  emptyMatchingProjectRequirements,
  matchingAvailabilityStates,
  matchingParticipationStates,
  matchingRequirementAvailabilityStates,
  matchingWorkArrangements,
  type CompanyMatchingContext,
  type CompanyTalentRecommendation,
  type MatchingAdministrationSummary,
  type MatchingFitSummary,
  type MatchingPreferences,
  type MatchingProjectRequirements,
  type MatchingSource,
  type TalentMatchingContext,
  type TalentProjectRecommendation,
} from "./types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const timestamp = (value: unknown) =>
  typeof value === "string" ? value : null;
const uuid = (value: unknown) =>
  /^[0-9a-f-]{36}$/i.test(text(value)) ? text(value) : "";
const boundedList = (value: unknown, maximum = 12) =>
  Array.isArray(value)
    ? value
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, maximum)
    : [];
const known = <T extends readonly string[]>(
  value: unknown,
  values: T,
  fallback: T[number]
) => (values.includes(value as T[number]) ? (value as T[number]) : fallback);
const safeHref = (value: unknown) =>
  /^\/[A-Za-z0-9_/?=&-]{1,500}$/.test(text(value)) ? text(value) : "/";

function sourceList(value: unknown): MatchingSource[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const row = asRecord(item);
        const type = text(row?.type);
        const href = safeHref(row?.href);
        if (
          !row ||
          !href ||
          ![
            "project_requirement",
            "active_public_human_verified_proof",
          ].includes(type)
        )
          return [];
        const proofs = Array.isArray(row.proofs) ? row.proofs : [];
        const detail = proofs
          .flatMap(proof => {
            const source = asRecord(proof);
            const skill = text(source?.skill_key);
            return skill ? [skill] : [];
          })
          .slice(0, 12)
          .join(", ");
        return [
          {
            type: type as MatchingSource["type"],
            href,
            label:
              type === "project_requirement"
                ? "Versioned project requirements"
                : "Active public human-verified proof",
            detail,
          },
        ];
      })
    : [];
}

function fitSummary(value: unknown): MatchingFitSummary {
  const row = asRecord(value);
  return {
    reasons: boundedList(row?.reasons, 8),
    gaps: boundedList(row?.gaps, 8),
    limitations: boundedList(row?.limitations, 8),
    ruleOrder: boundedList(row?.rule_order, 8),
  };
}

function preferences(value: unknown): MatchingPreferences {
  const row = asRecord(value);
  const fallback = emptyMatchingPreferences();
  return {
    projectRecommendationsState: known(
      row?.project_recommendations_state,
      matchingParticipationStates,
      fallback.projectRecommendationsState
    ),
    companyDiscoverabilityState: known(
      row?.company_discoverability_state,
      matchingParticipationStates,
      fallback.companyDiscoverabilityState
    ),
    availabilityStatus: known(
      row?.availability_status,
      matchingAvailabilityStates,
      fallback.availabilityStatus
    ),
    shareAvailabilityWithCompanies:
      row?.share_availability_with_companies === true,
    workArrangement: known(
      row?.work_arrangement,
      matchingWorkArrangements,
      fallback.workArrangement
    ),
    timezone: text(row?.timezone, "UTC").slice(0, 80),
    applicationCapacity: known(
      row?.application_capacity,
      matchingAvailabilityStates,
      fallback.applicationCapacity
    ),
    updatedAt: timestamp(row?.updated_at),
  };
}

function projectRequirements(
  value: unknown,
  fallbackProjectId: string
): MatchingProjectRequirements {
  const row = asRecord(value);
  const expectations = asRecord(row?.required_evidence_expectations) ?? {};
  const requiredEvidenceExpectations = Object.fromEntries(
    Object.entries(expectations).flatMap(([key, expectation]) =>
      /^[a-z0-9-]{1,80}$/.test(key) &&
      ["human_verified_public_proof", "context_only"].includes(
        text(expectation)
      )
        ? [
            [
              key,
              text(expectation) as
                "human_verified_public_proof" | "context_only",
            ],
          ]
        : []
    )
  );
  const fallback = emptyMatchingProjectRequirements(fallbackProjectId);
  return {
    projectId: uuid(row?.project_id) || fallbackProjectId,
    projectVersion:
      typeof row?.project_version === "number"
        ? row.project_version
        : fallback.projectVersion,
    isCurrentForProject: row?.is_current_for_project === true,
    version: typeof row?.version === "number" ? row.version : fallback.version,
    matchingEnabled: row?.matching_enabled === true,
    requiredEvidenceExpectations,
    availabilityExpectation: known(
      row?.availability_expectation,
      matchingRequirementAvailabilityStates,
      fallback.availabilityExpectation
    ),
    workArrangement: known(
      row?.work_arrangement,
      matchingWorkArrangements,
      fallback.workArrangement
    ),
    timezoneExpectation: text(row?.timezone_expectation).slice(0, 120),
    collaborationNeeds: text(row?.collaboration_needs).slice(0, 360),
  };
}

function talentProjectItems(value: unknown): TalentProjectRecommendation[] {
  const root = asRecord(value);
  return Array.isArray(root?.items)
    ? root.items.flatMap(item => {
        const row = asRecord(item);
        const project = asRecord(row?.project);
        const recommendationId = uuid(row?.recommendation_id);
        const publicId = text(project?.public_id);
        const href = safeHref(project?.href);
        if (
          !row ||
          !project ||
          !recommendationId ||
          !/^prj_[a-f0-9]{20,40}$/.test(publicId) ||
          href === "/"
        )
          return [];
        return [
          {
            recommendationId,
            project: {
              publicId,
              title: text(project.title).slice(0, 120),
              organizationName: text(project.organization_name).slice(0, 120),
              requiredSkills: boundedList(
                project.required_skills
              ) as TalentProjectRecommendation["project"]["requiredSkills"],
              helpfulSkills: boundedList(
                project.helpful_skills
              ) as TalentProjectRecommendation["project"]["helpfulSkills"],
              href,
            },
            fitSummary: fitSummary(row.fit_summary),
            sources: sourceList(row.sources),
          },
        ];
      })
    : [];
}

function companyTalentItems(value: unknown): CompanyTalentRecommendation[] {
  const root = asRecord(value);
  return Array.isArray(root?.items)
    ? root.items.flatMap(item => {
        const row = asRecord(item);
        const talent = asRecord(row?.talent);
        const recommendationId = uuid(row?.recommendation_id);
        const handle = text(talent?.handle);
        const href = safeHref(talent?.href);
        const availability = text(talent?.availability);
        if (
          !row ||
          !talent ||
          !recommendationId ||
          !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle) ||
          href === "/" ||
          ![...matchingAvailabilityStates, "not_shared"].includes(
            availability as never
          )
        )
          return [];
        return [
          {
            recommendationId,
            talent: {
              handle,
              displayName: text(talent.display_name, "Talent").slice(0, 80),
              availability:
                availability as CompanyTalentRecommendation["talent"]["availability"],
              href,
            },
            fitSummary: fitSummary(row.fit_summary),
            sources: sourceList(row.sources),
          },
        ];
      })
    : [];
}

export async function getTalentMatchingContext(): Promise<TalentMatchingContext | null> {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !authorization.ok || !supabase) return null;
  const [preferenceResult, recommendationResult] = await Promise.all([
    supabase.rpc("get_matching_talent_preferences"),
    supabase.rpc("get_matching_projects_for_talent", { maximum_count: 12 }),
  ]);
  const recommendation = asRecord(recommendationResult.data);
  const currentPreferences = preferenceResult.error
    ? emptyMatchingPreferences()
    : preferences(preferenceResult.data);
  return {
    preferences: currentPreferences,
    participationState: known(
      recommendation?.participation_state,
      matchingParticipationStates,
      currentPreferences.projectRecommendationsState
    ),
    ruleVersion: text(recommendation?.rule_version, "proof-match-v1"),
    items: recommendationResult.error
      ? []
      : talentProjectItems(recommendationResult.data),
    limitations: boundedList(recommendation?.limitations, 8),
  };
}

export async function getCompanyMatchingContext(
  projectId: string
): Promise<CompanyMatchingContext | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (
    !authorization.ok ||
    !authorization.context.active?.organizationId ||
    !supabase
  )
    return null;
  const [requirementResult, recommendationResult] = await Promise.all([
    supabase.rpc("get_matching_project_requirements", {
      requested_project_id: projectId,
    }),
    supabase.rpc("get_matching_talent_recommendations", {
      requested_project_id: projectId,
      maximum_count: 12,
    }),
  ]);
  if (requirementResult.error || recommendationResult.error) return null;
  const recommendation = asRecord(recommendationResult.data);
  return {
    projectId,
    ruleVersion: text(recommendation?.rule_version, "proof-match-v1"),
    state:
      recommendation?.state ===
      "requirements_not_current_or_project_not_recommendable"
        ? "requirements_not_current_or_project_not_recommendable"
        : "ready",
    requirements: projectRequirements(requirementResult.data, projectId),
    items: companyTalentItems(recommendationResult.data),
    limitations: boundedList(recommendation?.limitations, 8),
  };
}

export async function getMatchingAdministrationSummary(): Promise<MatchingAdministrationSummary | null> {
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "administrator" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_matching_administration_summary",
    { maximum_count: 80 }
  );
  const root = asRecord(data);
  if (error || !root) return null;
  const counts = asRecord(root.counts);
  return {
    rules: Array.isArray(root.rules)
      ? root.rules.flatMap(item => {
          const row = asRecord(item);
          const definition = asRecord(row?.rule_definition);
          const version = text(row?.version);
          return row && version
            ? [
                {
                  version,
                  state: text(row.state),
                  strategy: text(row.strategy),
                  excludedSignals: boundedList(
                    definition?.excluded_signals,
                    20
                  ),
                  createdAt: timestamp(row.created_at),
                },
              ]
            : [];
        })
      : [],
    metrics: Array.isArray(root.metrics)
      ? root.metrics.flatMap(item => {
          const row = asRecord(item);
          const metricKey = text(row?.metric_key);
          return row && metricKey
            ? [
                {
                  metricKey,
                  description: text(row.description).slice(0, 360),
                  measurementBoundary: text(row.measurement_boundary).slice(
                    0,
                    360
                  ),
                },
              ]
            : [];
        })
      : [],
    counts: {
      activeRecommendations:
        typeof counts?.active_recommendations === "number"
          ? counts.active_recommendations
          : 0,
      feedbackRecords:
        typeof counts?.feedback_records === "number"
          ? counts.feedback_records
          : 0,
      reports: typeof counts?.reports === "number" ? counts.reports : 0,
      humanReviewActions:
        typeof counts?.human_review_actions === "number"
          ? counts.human_review_actions
          : 0,
    },
    audit: Array.isArray(root.audit)
      ? root.audit.flatMap(item => {
          const row = asRecord(item);
          return row
            ? [
                {
                  eventType: text(row.event_type),
                  ruleVersion: text(row.rule_version),
                  occurredAt: timestamp(row.occurred_at),
                  metadata: asRecord(row.metadata) ?? {},
                },
              ]
            : [];
        })
      : [],
  };
}
