/** Evidence Ledger Editorial — Phase 30 parses minimal source-linked graph projections and rejects malformed public data. */
import "server-only";

import { isValidPublicHandle } from "@/lib/profile/handle";
import type { CanonicalSkillKey } from "@/lib/profile/types";
import { authorizeActiveContext } from "@/lib/roles/context";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  emptyPublicProofGraph,
  emptyTalentProofGraphAudit,
  proofReputationEventTypes,
  type PublicProofGraph,
  type TalentProofGraphAudit,
} from "./types";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const timestamp = (value: unknown) =>
  typeof value === "string" ? value : null;

const uuid = (value: unknown) => {
  const candidate = text(value);
  return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : "";
};

const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;

const canonicalSkill = (value: unknown) => {
  const candidate = text(value);
  return /^[a-z0-9-]{1,80}$/.test(candidate)
    ? (candidate as CanonicalSkillKey)
    : null;
};

function publicGraph(value: unknown): PublicProofGraph {
  const root = asRecord(value);
  const summary = asRecord(root?.summary);
  const graph = emptyPublicProofGraph();
  graph.summary = {
    activeVerifiedProofCount: count(summary?.active_verified_proof_count),
    verifiedSkillCount: count(summary?.verified_skill_count),
    consentedCompanyOutcomeCount: count(
      summary?.consented_company_outcome_count
    ),
    latestVerifiedAt: timestamp(summary?.latest_verified_at),
  };
  graph.timeline = Array.isArray(root?.timeline)
    ? root.timeline.flatMap(item => {
        const row = asRecord(item);
        const proofId = uuid(row?.proof_id);
        const skillKey = canonicalSkill(row?.skill_key);
        const evidencePublicId = uuid(row?.evidence_public_id);
        if (!row || !proofId || !skillKey || !evidencePublicId) return [];
        return [
          {
            proofId,
            skillKey,
            verificationMethod: text(row.verification_method).slice(0, 120),
            verifiedAt: timestamp(row.verified_at),
            evidencePublicId,
            evidenceTitle: text(row.evidence_title).slice(0, 180),
            projectPublicId: uuid(row.project_public_id) || null,
            projectTitle: text(row.project_title).slice(0, 180),
            reviewerAttribution: text(row.reviewer_attribution).slice(0, 120),
            verificationState: "human_verified" as const,
          },
        ];
      })
    : [];
  graph.skills = Array.isArray(root?.skills)
    ? root.skills.flatMap(item => {
        const row = asRecord(item);
        const skillKey = canonicalSkill(row?.skill_key);
        if (!row || !skillKey) return [];
        const evidence = Array.isArray(row.evidence)
          ? row.evidence.flatMap(source => {
              const sourceRow = asRecord(source);
              const proofId = uuid(sourceRow?.proof_id);
              const evidencePublicId = uuid(sourceRow?.evidence_public_id);
              if (!sourceRow || !proofId || !evidencePublicId) return [];
              return [
                {
                  proofId,
                  evidencePublicId,
                  evidenceTitle: text(sourceRow.evidence_title).slice(0, 180),
                  verifiedAt: timestamp(sourceRow.verified_at),
                },
              ];
            })
          : [];
        return [
          {
            skillKey,
            proofCount: count(row.proof_count),
            latestVerifiedAt: timestamp(row.latest_verified_at),
            evidence,
          },
        ];
      })
    : [];
  graph.companyOutcomes = Array.isArray(root?.company_outcomes)
    ? root.company_outcomes.flatMap(item => {
        const row = asRecord(item);
        const id = uuid(row?.id);
        const proofId = uuid(row?.proof_id);
        if (!row || !id || !proofId) return [];
        return [
          {
            id,
            proofId,
            outcomeType: text(row.outcome_type).slice(0, 80),
            contextSummary: text(row.context_summary).slice(0, 600),
            consentedAt: timestamp(row.consented_at),
          },
        ];
      })
    : [];
  graph.endorsements = Array.isArray(root?.endorsements)
    ? root.endorsements.flatMap(item => {
        const row = asRecord(item);
        const id = uuid(row?.id);
        const proofId = uuid(row?.proof_id);
        const skillKey = canonicalSkill(row?.skill_key);
        if (!row || !id || !proofId || !skillKey) return [];
        return [
          {
            id,
            proofId,
            skillKey,
            endorsementText: text(row.endorsement_text).slice(0, 600),
            consentedAt: timestamp(row.consented_at),
          },
        ];
      })
    : [];
  return graph;
}

function privateAudit(value: unknown): TalentProofGraphAudit {
  const root = asRecord(value);
  const audit = emptyTalentProofGraphAudit();
  audit.events = Array.isArray(root?.events)
    ? root.events.flatMap(item => {
        const row = asRecord(item);
        const id = uuid(row?.id);
        const eventType = text(row?.event_type);
        const visibility = text(row?.visibility);
        if (
          !row ||
          !id ||
          !proofReputationEventTypes.includes(
            eventType as (typeof proofReputationEventTypes)[number]
          ) ||
          !["private", "public", "restricted"].includes(visibility)
        ) {
          return [];
        }
        return [
          {
            id,
            eventType: eventType as (typeof proofReputationEventTypes)[number],
            visibility: visibility as "private" | "public" | "restricted",
            eventSummary: text(row.event_summary).slice(0, 480),
            sourceEventType: text(row.source_event_type).slice(0, 120),
            sourceEventId: uuid(row.source_event_id),
            publicProofId: uuid(row.public_proof_id) || null,
            occurredAt: timestamp(row.occurred_at),
          },
        ];
      })
    : [];
  audit.outcomes = Array.isArray(root?.outcomes)
    ? root.outcomes.flatMap(item => {
        const row = asRecord(item);
        const id = uuid(row?.id);
        const publicProofId = uuid(row?.public_proof_id);
        const state = text(row?.state);
        if (
          !row ||
          !id ||
          !publicProofId ||
          !["proposed", "consented", "withdrawn"].includes(state)
        ) {
          return [];
        }
        return [
          {
            id,
            publicProofId,
            outcomeType: text(row.outcome_type).slice(0, 80),
            contextSummary: text(row.context_summary).slice(0, 600),
            state: state as "proposed" | "consented" | "withdrawn",
            proposedAt: timestamp(row.proposed_at),
            consentedAt: timestamp(row.consented_at),
            withdrawnAt: timestamp(row.withdrawn_at),
          },
        ];
      })
    : [];
  audit.endorsements = Array.isArray(root?.endorsements)
    ? root.endorsements.flatMap(item => {
        const row = asRecord(item);
        const id = uuid(row?.id);
        const publicProofId = uuid(row?.public_proof_id);
        const skillKey = canonicalSkill(row?.skill_key);
        const state = text(row?.state);
        if (
          !row ||
          !id ||
          !publicProofId ||
          !skillKey ||
          !["proposed", "consented", "withdrawn"].includes(state)
        ) {
          return [];
        }
        return [
          {
            id,
            publicProofId,
            skillKey,
            endorsementText: text(row.endorsement_text).slice(0, 600),
            state: state as "proposed" | "consented" | "withdrawn",
            proposedAt: timestamp(row.proposed_at),
            consentedAt: timestamp(row.consented_at),
            withdrawnAt: timestamp(row.withdrawn_at),
          },
        ];
      })
    : [];
  return audit;
}

export async function getPublicTalentProofGraph(
  handle: string
): Promise<PublicProofGraph> {
  if (!isValidPublicHandle(handle)) return emptyPublicProofGraph();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return emptyPublicProofGraph();
  const { data, error } = await supabase.rpc("get_public_talent_proof_graph", {
    requested_handle: handle,
  });
  return error ? emptyPublicProofGraph() : publicGraph(data);
}

export async function getTalentProofGraphAudit(): Promise<TalentProofGraphAudit | null> {
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_private_talent_proof_graph_audit"
  );
  return error ? null : privateAudit(data);
}
