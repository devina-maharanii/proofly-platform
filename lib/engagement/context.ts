/** Phase 33 private reader boundary: guarded Supabase RPC responses are parsed defensively and no engagement term is exposed outside an authorized participant or administrator context. */
import "server-only";

import { getRoleContext, authorizeActiveContext } from "@/lib/roles/context";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  engagementStates,
  engagementTypes,
  type EngagementDetail,
  type EngagementDisputeQueueItem,
  type EngagementListItem,
  type EngagementMarketOption,
  type EngagementState,
  type EngagementTerms,
  type EngagementType,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
const optionalText = (value: unknown) =>
  typeof value === "string" ? value : null;
const number = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const items = (value: unknown) => (Array.isArray(value) ? value : []);
const uuid = (value: unknown) => /^[0-9a-f-]{36}$/i.test(text(value));
const engagementType = (value: unknown): EngagementType | null =>
  engagementTypes.includes(text(value) as EngagementType)
    ? (text(value) as EngagementType)
    : null;
const engagementState = (value: unknown): EngagementState | null =>
  engagementStates.includes(text(value) as EngagementState)
    ? (text(value) as EngagementState)
    : null;

const terms = (value: unknown): EngagementTerms | null => {
  const row = record(value);
  if (!row || !uuid(row.id)) return null;
  const snapshot = record(row.snapshot);
  return {
    id: text(row.id),
    version: number(row.version),
    state: text(row.state),
    acceptedAt: optionalText(row.accepted_at),
    snapshot: snapshot ?? {},
  };
};

const detail = (value: unknown): EngagementDetail | null => {
  const row = record(value);
  const type = engagementType(row?.engagement_type);
  const state = engagementState(row?.state);
  const role = text(row?.participant_role);
  if (
    !row ||
    !uuid(row.id) ||
    !type ||
    !state ||
    (role !== "talent" && role !== "company")
  )
    return null;
  const safety = record(row.safety);
  return {
    id: text(row.id),
    engagementType: type,
    state,
    fundingState: text(row.funding_state),
    marketCode: text(row.market_code),
    currency: text(row.currency),
    projectId: text(row.project_id),
    applicationId: text(row.application_id),
    workspaceId: optionalText(row.workspace_id),
    parentEngagementId: optionalText(row.parent_engagement_id),
    projectTitle: text(row.project_title),
    organizationName: text(row.organization_name),
    participantRole: role,
    proposalExpiresAt: optionalText(row.proposal_expires_at),
    terms: terms(row.terms),
    termsHistory: items(row.terms_history).flatMap(item => {
      const parsed = terms(item);
      return parsed ? [parsed] : [];
    }),
    acceptances: items(row.acceptances).flatMap(item => {
      const entry = record(item);
      const participantRole = text(entry?.participant_role);
      return entry &&
        uuid(entry.terms_version_id) &&
        (participantRole === "talent" || participantRole === "company")
        ? [
            {
              termsVersionId: text(entry.terms_version_id),
              participantRole,
              isCurrentActor: entry.is_current_actor === true,
              acceptedAt: optionalText(entry.accepted_at),
            },
          ]
        : [];
    }),
    negotiation: items(row.negotiation).flatMap(item => {
      const entry = record(item);
      return entry && uuid(entry.id)
        ? [
            {
              id: text(entry.id),
              entryType: text(entry.entry_type),
              body: text(entry.body),
              isCurrentActor: entry.is_current_actor === true,
              createdAt: optionalText(entry.created_at),
            },
          ]
        : [];
    }),
    milestones: items(row.milestones).flatMap(item => {
      const entry = record(item);
      return entry && uuid(entry.id)
        ? [
            {
              id: text(entry.id),
              index: number(entry.index),
              title: text(entry.title),
              description: text(entry.description),
              deliverableType: text(entry.deliverable_type),
              definitionOfDone: text(entry.definition_of_done),
              dueDate: text(entry.due_date),
              amountMinor: number(entry.amount_minor),
              currency: text(entry.currency),
              revisionAllowance: number(entry.revision_allowance),
              state: text(entry.state),
              timeoutPolicy: text(entry.timeout_policy),
              evidencePolicy: text(entry.evidence_policy),
              submissionCount: number(entry.submission_count),
            },
          ]
        : [];
    }),
    accessGrants: items(row.access_grants).flatMap(item => {
      const entry = record(item);
      return entry && uuid(entry.id)
        ? [
            {
              id: text(entry.id),
              accessKind: text(entry.access_kind),
              resourceLabel: text(entry.resource_label),
              purpose: text(entry.purpose),
              state: text(entry.state),
              expiresAt: optionalText(entry.expires_at),
              isCurrentActorRequest: entry.is_current_actor_request === true,
            },
          ]
        : [];
    }),
    disputes: items(row.disputes).flatMap(item => {
      const entry = record(item);
      return entry && uuid(entry.id)
        ? [
            {
              id: text(entry.id),
              milestoneId: optionalText(entry.milestone_id),
              category: text(entry.category),
              reason: text(entry.reason),
              requestedRemedy: text(entry.requested_remedy),
              state: text(entry.state),
              openedAt: optionalText(entry.opened_at),
            },
          ]
        : [];
    }),
    events: items(row.events).flatMap(item => {
      const entry = record(item);
      return entry && text(entry.event_type)
        ? [
            {
              eventType: text(entry.event_type),
              previousState: optionalText(entry.previous_state),
              nextState: optionalText(entry.next_state),
              occurredAt: optionalText(entry.occurred_at),
            },
          ]
        : [];
    }),
    safety: {
      platformRecordNotLegalDetermination:
        safety?.platform_record_not_legal_determination === true,
      paymentExecution: text(safety?.payment_execution),
      productionAccess: text(safety?.production_access),
      personalCredentials: text(safety?.personal_credentials),
      supportRoute: text(safety?.support_route),
    },
  };
};

const list = (value: unknown): EngagementListItem[] =>
  items(value).flatMap(item => {
    const row = record(item);
    const type = engagementType(row?.engagement_type);
    const state = engagementState(row?.state);
    return row && uuid(row.id) && type && state
      ? [
          {
            id: text(row.id),
            applicationId: uuid(row.application_id)
              ? text(row.application_id)
              : null,
            engagementType: type,
            state,
            fundingState: text(row.funding_state),
            projectTitle: text(row.project_title),
            organizationName: text(row.organization_name),
            updatedAt: optionalText(row.updated_at),
          },
        ]
      : [];
  });

export async function getEngagementList(): Promise<{
  activeRole: string | null;
  items: EngagementListItem[];
}> {
  const [roleContext, supabase] = await Promise.all([
    getRoleContext(),
    createServerSupabaseClient(),
  ]);
  if (!roleContext?.active || !supabase) return { activeRole: null, items: [] };
  const role = roleContext.active.role;
  if (role !== "talent" && role !== "company_member")
    return { activeRole: role, items: [] };
  const { data, error } = await supabase.rpc(
    role === "talent" ? "get_talent_engagements" : "get_company_engagements",
    { maximum_count: 50 }
  );
  return { activeRole: role, items: error ? [] : list(data) };
}

export async function getParticipantEngagement(
  engagementId: string
): Promise<EngagementDetail | null> {
  if (!uuid(engagementId)) return null;
  const [session, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) return null;
  const { data, error } = await supabase.rpc("get_engagement_for_participant", {
    requested_engagement_id: engagementId,
  });
  return error ? null : detail(data);
}

export async function getEngagementMarketOptions(): Promise<
  EngagementMarketOption[]
> {
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return [];
  const { data, error } = await supabase.rpc("get_engagement_market_options");
  if (error) return [];
  return items(data).flatMap(item => {
    const row = record(item);
    const state = text(row?.state);
    return row && (state === "approved" || state === "limited")
      ? [
          {
            marketCode: text(row.market_code),
            currency: text(row.currency),
            state,
            limitationNotice: text(row.limitation_notice),
            supportRoute: text(row.support_route),
            termsVersionLabel: text(row.terms_version_label),
          },
        ]
      : [];
  });
}

export async function getEngagementDisputeQueue(): Promise<
  EngagementDisputeQueueItem[]
> {
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "administrator" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return [];
  const { data, error } = await supabase.rpc("get_engagement_dispute_queue", {
    maximum_count: 50,
  });
  if (error) return [];
  return items(data).flatMap(item => {
    const row = record(item);
    return row && uuid(row.id) && uuid(row.engagement_id)
      ? [
          {
            id: text(row.id),
            engagementId: text(row.engagement_id),
            milestoneId: optionalText(row.milestone_id),
            category: text(row.category),
            reason: text(row.reason),
            requestedRemedy: text(row.requested_remedy),
            state: text(row.state),
            openedAt: optionalText(row.opened_at),
          },
        ]
      : [];
  });
}
