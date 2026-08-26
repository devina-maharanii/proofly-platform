/** Phase 24 server readers: application content is private to its Talent owner and authorized Company members; public Project data never exposes application records. */
import "server-only";

import { getTalentWorkEvidenceList } from "@/lib/evidence/context";
import { getPublicProject } from "@/lib/project/context";
import { authorizeActiveContext } from "@/lib/roles/context";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import type {
  ApplicationEvent,
  ApplicationEvidenceSnapshot,
  ApplicationListItem,
  ApplicationProfileSnapshot,
  ApplicationState,
  ApplicationTermsSnapshot,
  CompanyApplicationReceipt,
  ProjectApplication,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const applicationState = (value: unknown): ApplicationState =>
  [
    "draft",
    "submitted",
    "withdrawn",
    "shortlisted",
    "invited_to_trial",
    "accepted",
    "rejected",
    "closed",
  ].includes(text(value))
    ? (value as ApplicationState)
    : "draft";

const stringOrNull = (value: unknown) =>
  typeof value === "string" ? value : null;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const profileSnapshot = (value: unknown): ApplicationProfileSnapshot => {
  const row = record(value);
  const skills = Array.isArray(row?.skills)
    ? row.skills.flatMap(item => {
        const skill = record(item);
        const skillKey = text(skill?.skill_key);
        return skillKey
          ? [
              {
                skillKey:
                  skillKey as ApplicationProfileSnapshot["skills"][number]["skillKey"],
                claimedLevel: text(skill?.claimed_level),
                context: text(skill?.context),
              },
            ]
          : [];
      })
    : [];
  return {
    displayName: text(row?.display_name),
    headline: text(row?.headline),
    developerFocus: text(row?.developer_focus),
    skills,
  };
};

const evidenceSnapshot = (value: unknown): ApplicationEvidenceSnapshot[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const evidenceId = text(row?.evidence_id);
        if (!evidenceId) return [];
        const skills = Array.isArray(row?.skills)
          ? row.skills.flatMap(skillItem => {
              const skill = record(skillItem);
              const skillKey = text(skill?.skill_key);
              return skillKey
                ? [
                    {
                      skillKey:
                        skillKey as ApplicationEvidenceSnapshot["skills"][number]["skillKey"],
                      context: text(skill?.context),
                    },
                  ]
                : [];
            })
          : [];
        return [
          {
            evidenceId,
            sourceVersion:
              typeof row?.source_version === "number" ? row.source_version : 1,
            sharingChoice: "application_private_receipt" as const,
            title: text(row?.title),
            shortSummary: text(row?.short_summary),
            evidenceType: text(row?.evidence_type),
            userRole: text(row?.user_role),
            skills,
          },
        ];
      })
    : [];

const termsSnapshot = (value: unknown): ApplicationTermsSnapshot | null => {
  const row = record(value);
  if (!row || Object.keys(row).length === 0) return null;
  return {
    projectPublicId: text(row.project_public_id),
    projectTitle: text(row.project_title),
    applicationDeadline: text(row.application_deadline),
    compensationStatus: text(row.compensation_status),
    workPurpose: text(row.work_purpose),
    timeboxHours:
      typeof row.timebox_hours === "number" ? row.timebox_hours : null,
    ownershipTerms: text(row.ownership_terms),
    dataAccessRestrictions: text(row.data_access_restrictions),
    participantExpectations: text(row.participant_expectations),
    expectedResponseTime: text(row.expected_response_time),
    noProductionReuse: row.no_production_reuse === true,
  };
};

const events = (value: unknown): ApplicationEvent[] =>
  Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const eventType = text(row?.event_type);
        return eventType
          ? [
              {
                eventType,
                previousState: row?.previous_state
                  ? applicationState(row.previous_state)
                  : null,
                nextState: row?.next_state
                  ? applicationState(row.next_state)
                  : null,
                occurredAt: stringOrNull(row?.occurred_at),
              },
            ]
          : [];
      })
    : [];

function projectApplication(value: unknown): ProjectApplication | null {
  const row = record(value);
  const project = record(row?.project);
  const id = text(row?.id);
  if (!id || !project) return null;
  return {
    id,
    state: applicationState(row?.state),
    project: {
      publicId: text(project.public_id),
      title: text(project.title),
      organizationName: text(project.organization_name),
      applicationDeadline: text(project.application_deadline),
      expectedResponseTime: text(project.expected_response_time),
    },
    profileSnapshot: profileSnapshot(row?.profile_snapshot),
    evidenceSnapshot: evidenceSnapshot(row?.evidence_snapshot),
    availability: text(row?.availability),
    timezoneOverlap: text(row?.timezone_overlap),
    motivation: text(row?.motivation),
    relevantExperience: text(row?.relevant_experience),
    projectResponse: text(row?.project_response),
    approach: text(row?.approach),
    termsConfirmed: row?.terms_confirmed === true,
    termsSnapshot: termsSnapshot(row?.terms_snapshot),
    submittedAt: stringOrNull(row?.submitted_at),
    withdrawnAt: stringOrNull(row?.withdrawn_at),
    createdAt: stringOrNull(row?.created_at),
    updatedAt: stringOrNull(row?.updated_at),
    events: events(row?.events),
  };
}

export async function getTalentProjectApplication(
  applicationId: string
): Promise<ProjectApplication | null> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return null;
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return null;
  const { data, error } = await supabase.rpc("get_talent_project_application", {
    requested_application_id: applicationId,
  });
  return error ? null : projectApplication(data);
}

export async function getTalentProjectApplications(): Promise<
  ApplicationListItem[]
> {
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return [];
  const { data, error } = await supabase.rpc(
    "get_talent_project_applications",
    {
      maximum_count: 50,
    }
  );
  if (error || !Array.isArray(data)) return [];
  return data.flatMap(item => {
    const row = record(item);
    const id = text(row?.id);
    const projectPublicId = text(row?.project_public_id);
    if (!id || !projectPublicId) return [];
    return [
      {
        id,
        state: applicationState(row?.state),
        projectPublicId,
        projectTitle: text(row?.project_title),
        organizationName: text(row?.organization_name),
        expectedResponseTime: text(row?.expected_response_time),
        applicationDeadline: text(row?.application_deadline),
        submittedAt: stringOrNull(row?.submitted_at),
        withdrawnAt: stringOrNull(row?.withdrawn_at),
        updatedAt: stringOrNull(row?.updated_at),
      },
    ];
  });
}

export async function getApplicationEditorContext(
  publicId: string
): Promise<import("./types").ApplicationEditorContext | null> {
  const [session, authorization, project, evidence] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    getPublicProject(publicId),
    getTalentWorkEvidenceList(),
  ]);
  if (!session || !project) return null;
  const existingApplication = authorization.ok
    ? await getApplicationForProject(publicId)
    : null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    project,
    existingApplication,
    availableEvidence: (evidence ?? [])
      .filter(item => item.state !== "archived")
      .map(item => ({
        id: item.id,
        title: item.title,
        shortSummary: item.shortSummary,
        evidenceType: item.evidenceType,
        userRole: item.userRole,
        state: item.state,
        version: item.version,
      })),
    activeTalentContext: authorization.ok,
    canApply:
      authorization.ok &&
      project.state === "accepting_applications" &&
      project.applicationDeadline >= today &&
      (existingApplication?.state === "draft" || !existingApplication),
  };
}

async function getApplicationForProject(publicId: string) {
  const applications = await getTalentProjectApplications();
  const draftOrActive = applications.find(
    item =>
      item.projectPublicId === publicId &&
      [
        "draft",
        "submitted",
        "shortlisted",
        "invited_to_trial",
        "accepted",
      ].includes(item.state)
  );
  return draftOrActive ? getTalentProjectApplication(draftOrActive.id) : null;
}

export async function getCompanyProjectApplicationReceipt(
  applicationId: string
): Promise<CompanyApplicationReceipt | null> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return null;
  const [authorization, supabase] = await Promise.all([
    authorizeActiveContext({ role: "company_member" }),
    createServerSupabaseClient(),
  ]);
  if (!authorization.ok || !supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_company_project_application_receipt",
    { requested_application_id: applicationId }
  );
  if (error) return null;
  const application = projectApplication(data);
  if (!application) return null;
  const row = record(data);
  return {
    ...application,
    retentionNotice: text(row?.retention_notice) || null,
  };
}
