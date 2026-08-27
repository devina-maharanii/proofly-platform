/** Phase 32 contract: explanation, consent, provenance, and human accountability remain enforceable across UI and database layers. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  matchingEvaluationDatasetScope,
  matchingEvaluationMetrics,
} from "@/lib/matching/evaluation";
import {
  emptyMatchingPreferences,
  matchingHumanActions,
  matchingParticipationStates,
} from "@/lib/matching/types";

const read = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf8");

const foundation = read(
  "supabase/migrations/202608270046_phase32_matching_foundation.sql"
);
const commands = read(
  "supabase/migrations/202608270047_phase32_matching_readers_and_commands.sql"
);
const matchingContext = read("lib/matching/context.ts");
const matchingActions = read("lib/matching/actions.ts");
const matchingSurface = read("components/matching/matching-surfaces.tsx");

describe("Phase 32 explainable talent matching contract", () => {
  it("defaults participation and company discovery to withdrawn", () => {
    expect(emptyMatchingPreferences().projectRecommendationsState).toBe(
      "withdrawn"
    );
    expect(emptyMatchingPreferences().companyDiscoverabilityState).toBe(
      "withdrawn"
    );
    expect(matchingParticipationStates).toEqual([
      "enabled",
      "paused",
      "withdrawn",
    ]);
    expect(foundation).toContain("default 'withdrawn'");
  });

  it("uses a single explicit versioned deterministic rule with published excluded signals", () => {
    expect(foundation).toContain("'proof-match-v1'");
    expect(foundation).toContain("'deterministic_proof_alignment'");
    expect(foundation).toContain("matching_rule_versions_one_active_idx");
    for (const signal of [
      "popularity",
      "private_message",
      "protected_attribute",
      "identity_assurance",
      "geography",
    ]) {
      expect(foundation).toContain(`'${signal}'`);
    }
  });

  it("uses only active human-verified public proof and current published project input", () => {
    for (const requirement of [
      "proof.status = 'verified'",
      "proof.revoked_at is null",
      "verification.state = 'verified'",
      "verification_proof.state = 'public'",
      "evidence.state = 'published'",
      "requirement.source_project_version = project.version",
      "project.state = 'accepting_applications'",
      "project.visibility = 'public'",
    ]) {
      expect(foundation + commands).toContain(requirement);
    }
  });

  it("rechecks source eligibility before feedback, reports, dismissals, and human controls", () => {
    expect(commands).toContain(
      "private.require_matching_recommendation_for_viewer"
    );
    expect(commands).toContain(
      "private.matching_talent_recommendation_items(auth.uid(), 25)"
    );
    expect(commands).toContain(
      "private.matching_company_recommendation_items(project, 25)"
    );
    expect(commands).toContain("then raise exception 'NOT_FOUND_OR_PRIVATE'");
  });

  it("stores input provenance and fit explanations, not a numeric fit score", () => {
    expect(foundation).toContain("input_fingerprint text not null");
    expect(foundation).toContain("input_sources jsonb not null");
    expect(foundation).toContain("fit_summary jsonb not null");
    expect(commands).toContain("'reasons'");
    expect(commands).toContain("'gaps'");
    expect(commands).toContain("'limitations'");
    expect(commands).not.toMatch(/fit_score|match_score|ranking_score/i);
    expect(matchingSurface).toContain("Why this appears");
    expect(matchingSurface).not.toMatch(
      /fit score|match score|ranking score|best candidate|top candidate/i
    );
  });

  it("keeps private messages, profile claims, identity signals, and popularity out of matching readers", () => {
    expect(commands).not.toMatch(
      /communication_messages|communication_conversations|communication_notifications/
    );
    expect(commands).not.toMatch(
      /talent_profile_drafts|work_evidence_items|work_evidence_skills/
    );
    expect(matchingContext).not.toMatch(
      /communication|message_content|private_message/i
    );
    expect(matchingEvaluationDatasetScope.prohibitedData).toEqual(
      expect.arrayContaining([
        "private messages",
        "protected attributes",
        "identity assurance",
        "popularity",
      ])
    );
  });

  it("uses restricted tables with RLS and public RPC entry points only", () => {
    for (const table of [
      "matching_talent_preferences",
      "matching_project_requirement_revisions",
      "matching_recommendations",
      "matching_recommendation_feedback",
      "matching_recommendation_reports",
      "matching_human_overrides",
      "matching_audit_events",
    ]) {
      expect(foundation).toContain(
        `alter table public.${table} enable row level security`
      );
    }
    expect(foundation).toContain("from anon, authenticated");
    expect(commands).toContain(
      "grant execute on function public.save_matching_project_requirements"
    );
    expect(matchingActions).toContain("getVerifiedAuthSession");
    expect(matchingActions).toContain("authorizeActiveContext");
  });

  it("makes feedback and reports immutable, idempotent, and separate from proof or reputation", () => {
    expect(commands).toContain(
      "on conflict (actor_user_id, idempotency_key) do nothing"
    );
    expect(commands).toContain(
      "on conflict (reporter_user_id, idempotency_key) do nothing"
    );
    expect(commands).toContain("matching.recommendation_dismissed");
    expect(commands).toContain("matching.feedback_recorded");
    expect(commands).toContain("matching.report_recorded");
    expect(matchingActions).toContain(
      "separately from proof, reputation, and hiring decisions"
    );
  });

  it("records only accountable human review actions and never creates application, shortlist, invite, contract, or hiring state", () => {
    expect(matchingHumanActions).toEqual([
      "shortlist_for_review",
      "invite_for_human_review",
      "hide_from_team",
    ]);
    expect(commands).toContain("record_matching_human_override");
    expect(commands).not.toMatch(
      /update public\.project_applications|insert into public\.project_applications|transition_company_project/
    );
    expect(matchingSurface).toMatch(
      /does not change\s+an application, issue an invitation, create a contract, or make a hiring\s+decision/
    );
  });

  it("keeps optional AI extraction disabled, server-only, source-bound, and non-decisional", () => {
    const aiBoundary = read("lib/matching/ai.ts");
    expect(aiBoundary).toContain('import "server-only"');
    expect(aiBoundary).toContain('id: "matching-ai-disabled"');
    expect(aiBoundary).toContain("enabled: false");
    expect(aiBoundary).toContain("return null");
    expect(aiBoundary).toContain(
      "no model call makes a hiring or proof decision"
    );
  });

  it("publishes evaluation definitions without fabricating performance claims or protected cohorts", () => {
    expect(matchingEvaluationMetrics).toHaveLength(5);
    expect(matchingEvaluationMetrics.map(metric => metric.key)).toEqual(
      expect.arrayContaining([
        "relevance_feedback_rate",
        "explanation_coverage",
        "false_positive_signal_rate",
        "fairness_review_coverage",
      ])
    );
    expect(matchingEvaluationDatasetScope.kind).toBe(
      "synthetic_contract_cases"
    );
    expect(foundation).toContain(
      "No success claim is derived from missing feedback."
    );
  });
});
