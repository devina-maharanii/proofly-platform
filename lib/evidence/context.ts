import "server-only";

import { authorizeActiveContext } from "@/lib/roles/context";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import type { CanonicalSkillKey } from "@/lib/profile/types";
import { isValidPublicHandle } from "@/lib/profile/handle";

import {
  emptyWorkEvidence,
  type PublicWorkEvidence,
  type PublicWorkEvidenceListItem,
  type WorkEvidence,
  type WorkEvidenceAttribution,
  type WorkEvidenceEditorContext,
  type WorkEvidenceLink,
  type WorkEvidencePublication,
  type WorkEvidenceSkill,
  type WorkEvidenceState,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const workEvidenceState = (value: unknown): WorkEvidenceState =>
  [
    "draft",
    "private",
    "unlisted",
    "published",
    "archived",
    "under_review",
    "verified",
  ].includes(text(value))
    ? (value as WorkEvidenceState)
    : "draft";

const normalizeSkills = (value: unknown): WorkEvidenceSkill[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const skillKey = text(row.skill_key ?? row.skillKey);
        return skillKey
          ? [
              {
                skillKey: skillKey as CanonicalSkillKey,
                taxonomyVersion: "1.0.0" as const,
                context: text(row.context),
              },
            ]
          : [];
      })
    : [];

const normalizeLinks = (value: unknown): WorkEvidenceLink[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const linkType = text(row.link_type ?? row.linkType);
        const availability = text(row.availability);
        if (
          !["repository", "demo", "media", "case_study", "other"].includes(
            linkType
          ) ||
          !["available", "unavailable", "private"].includes(availability)
        ) {
          return [];
        }
        return [
          {
            linkType: linkType as WorkEvidenceLink["linkType"],
            label: text(row.label),
            url: text(row.url),
            availability: availability as WorkEvidenceLink["availability"],
            isPublic: row.is_public === true || row.isPublic === true,
          },
        ];
      })
    : [];

const normalizeAttributions = (value: unknown): WorkEvidenceAttribution[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const row = item as Record<string, unknown>;
        const contributorName = text(
          row.contributor_name ?? row.contributorName
        );
        return contributorName
          ? [
              {
                contributorName,
                contributorRole: text(
                  row.contributor_role ?? row.contributorRole
                ),
                sourceReferenceUrl: text(
                  row.source_reference_url ?? row.sourceReferenceUrl
                ),
                isPublic: row.is_public === true || row.isPublic === true,
              },
            ]
          : [];
      })
    : [];

const normalizeEvidence = (
  row: Record<string, unknown> | null,
  skills: WorkEvidenceSkill[],
  links: WorkEvidenceLink[],
  attributions: WorkEvidenceAttribution[]
): WorkEvidence => {
  if (!row) return { ...emptyWorkEvidence(), skills, links, attributions };
  return {
    id: text(row.id),
    title: text(row.title),
    shortSummary: text(row.short_summary),
    evidenceType: text(
      row.evidence_type,
      "personal_project"
    ) as WorkEvidence["evidenceType"],
    problemGoal: text(row.problem_goal),
    userRole: text(row.user_role),
    personalContribution: text(row.personal_contribution),
    contributionScope: text(row.contribution_scope),
    contextConstraints: text(row.context_constraints),
    decisionsTradeoffs: text(row.decisions_tradeoffs),
    outcomeStatus: text(row.outcome_status),
    teamWork: row.team_work === true,
    ownershipStatus: text(
      row.ownership_status,
      "owns"
    ) as WorkEvidence["ownershipStatus"],
    permissionNote: text(row.permission_note),
    startedOn: text(row.started_on),
    durationText: text(row.duration_text),
    state: workEvidenceState(row.state),
    version: typeof row.version === "number" ? row.version : 1,
    skills,
    links,
    attributions,
  };
};

const normalizePublication = (
  row: Record<string, unknown> | null
): WorkEvidencePublication | null => {
  if (!row) return null;
  const state = text(row.state);
  if (!["private", "unlisted", "published", "archived"].includes(state))
    return null;
  return {
    publicId: text(row.public_id),
    state: state as WorkEvidencePublication["state"],
    sourceVersion:
      typeof row.source_version === "number" ? row.source_version : 1,
    publishedAt: text(row.published_at) || null,
    hiddenAt: text(row.hidden_at) || null,
    archivedAt: text(row.archived_at) || null,
  };
};

export async function getWorkEvidenceEditorContext(
  evidenceId?: string
): Promise<WorkEvidenceEditorContext | null> {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) return null;
  if (evidenceId && !/^[0-9a-f-]{36}$/i.test(evidenceId)) return null;
  if (!evidenceId) {
    return {
      evidence: emptyWorkEvidence(),
      publication: null,
      activeTalentContext: authorization.ok,
    };
  }

  const [
    itemResult,
    skillsResult,
    linksResult,
    attributionsResult,
    publicationResult,
  ] = await Promise.all([
    supabase
      .from("work_evidence_items")
      .select("*")
      .eq("id", evidenceId)
      .eq("user_id", session.userId)
      .maybeSingle(),
    supabase
      .from("work_evidence_skills")
      .select("skill_key, taxonomy_version, context")
      .eq("evidence_id", evidenceId)
      .eq("user_id", session.userId)
      .order("skill_key"),
    supabase
      .from("work_evidence_links")
      .select("link_type, label, url, availability, is_public")
      .eq("evidence_id", evidenceId)
      .eq("user_id", session.userId)
      .order("created_at"),
    supabase
      .from("work_evidence_attributions")
      .select(
        "contributor_name, contributor_role, source_reference_url, is_public"
      )
      .eq("evidence_id", evidenceId)
      .eq("user_id", session.userId)
      .order("created_at"),
    supabase
      .from("work_evidence_publications")
      .select(
        "public_id, state, source_version, published_at, hidden_at, archived_at"
      )
      .eq("evidence_id", evidenceId)
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);
  if (!itemResult.data) return null;
  return {
    evidence: normalizeEvidence(
      itemResult.data as Record<string, unknown>,
      normalizeSkills(skillsResult.data ?? []),
      normalizeLinks(linksResult.data ?? []),
      normalizeAttributions(attributionsResult.data ?? [])
    ),
    publication: normalizePublication(
      publicationResult.data as Record<string, unknown> | null
    ),
    activeTalentContext: authorization.ok,
  };
}

export async function getTalentWorkEvidenceList(): Promise<
  WorkEvidence[] | null
> {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase || !authorization.ok) return null;
  const { data } = await supabase
    .from("work_evidence_items")
    .select(
      "id, title, short_summary, evidence_type, user_role, state, version, updated_at"
    )
    .eq("user_id", session.userId)
    .order("updated_at", { ascending: false });
  return (data ?? []).flatMap(item => {
    const row = item as Record<string, unknown>;
    const id = text(row.id);
    return id
      ? [
          {
            ...emptyWorkEvidence(),
            id,
            title: text(row.title),
            shortSummary: text(row.short_summary),
            evidenceType: text(
              row.evidence_type,
              "personal_project"
            ) as WorkEvidence["evidenceType"],
            userRole: text(row.user_role),
            state: workEvidenceState(row.state),
            version: typeof row.version === "number" ? row.version : 1,
          },
        ]
      : [];
  });
}

const normalizePublicEvidence = (
  value: Record<string, unknown>
): PublicWorkEvidence | null => {
  const publicId = text(value.public_id);
  const state = text(value.state);
  const evidenceType = text(value.evidence_type);
  if (
    !publicId ||
    !["published", "unlisted"].includes(state) ||
    ![
      "personal_project",
      "open_source_contribution",
      "coursework_project",
      "company_project",
      "freelance_project",
      "challenge_submission",
      "technical_article_or_case_study",
    ].includes(evidenceType)
  ) {
    return null;
  }
  return {
    publicId,
    title: text(value.title),
    shortSummary: text(value.short_summary),
    evidenceType: evidenceType as WorkEvidence["evidenceType"],
    problemGoal: text(value.problem_goal),
    userRole: text(value.user_role),
    personalContribution: text(value.personal_contribution),
    contributionScope: text(value.contribution_scope),
    contextConstraints: text(value.context_constraints),
    decisionsTradeoffs: text(value.decisions_tradeoffs),
    outcomeStatus: text(value.outcome_status),
    teamWork: value.team_work === true,
    ownershipStatus: text(
      value.ownership_status,
      "owns"
    ) as WorkEvidence["ownershipStatus"],
    startedOn: text(value.started_on),
    durationText: text(value.duration_text),
    skills: normalizeSkills(value.skills),
    links: normalizeLinks(value.links).map(link => ({
      linkType: link.linkType,
      label: link.label,
      url: link.url,
      availability: link.availability,
    })),
    attributions: normalizeAttributions(value.attributions).map(
      attribution => ({
        contributorName: attribution.contributorName,
        contributorRole: attribution.contributorRole,
        sourceReferenceUrl: attribution.sourceReferenceUrl,
      })
    ),
    verificationStatus: "not_verified",
    state: state as PublicWorkEvidence["state"],
    sourceVersion:
      typeof value.source_version === "number" ? value.source_version : 1,
    publishedAt: text(value.published_at) || null,
  };
};

export async function getPublicWorkEvidence(
  publicId: string
): Promise<PublicWorkEvidence | null> {
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_work_evidence", {
    requested_public_id: publicId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return null;
  return normalizePublicEvidence(data as Record<string, unknown>);
}

export async function getPublicTalentWorkEvidence(
  handle: string
): Promise<PublicWorkEvidenceListItem[]> {
  if (!isValidPublicHandle(handle)) return [];
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_public_talent_work_evidence",
    {
      requested_handle: handle,
    }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    const publicId = text(value.public_id);
    const evidenceType = text(value.evidence_type);
    if (!publicId || !workEvidenceTypeNames.includes(evidenceType)) return [];
    return [
      {
        publicId,
        title: text(value.title),
        shortSummary: text(value.short_summary),
        evidenceType: evidenceType as WorkEvidence["evidenceType"],
        userRole: text(value.user_role),
        skills: normalizeSkills(value.skills),
        verificationStatus: "not_verified" as const,
        sourceVersion:
          typeof value.source_version === "number" ? value.source_version : 1,
        publishedAt: text(value.published_at) || null,
      },
    ];
  });
}

const workEvidenceTypeNames = [
  "personal_project",
  "open_source_contribution",
  "coursework_project",
  "company_project",
  "freelance_project",
  "challenge_submission",
  "technical_article_or_case_study",
];
