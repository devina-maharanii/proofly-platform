/** Design: Evidence Ledger Editorial — parse private rubric records defensively and keep historical versions distinct from the editable current draft. */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  ProjectRubric,
  RubricCalibrationExample,
  RubricDescriptor,
  RubricDescriptorLevel,
  RubricDimension,
  RubricDimensionPriority,
  RubricFeedbackVisibility,
  RubricState,
  RubricVersion,
  RubricVersionState,
} from "./types";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringList = (value: unknown, maximum: number) =>
  Array.isArray(value)
    ? value
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, maximum)
    : [];

const knownRubricState = (value: unknown): RubricState =>
  value === "ready_for_review" ||
  value === "published" ||
  value === "locked" ||
  value === "archived"
    ? value
    : "draft";

const knownVersionState = (value: unknown): RubricVersionState =>
  value === "published" || value === "locked" || value === "archived"
    ? value
    : "draft";

const knownPriority = (value: unknown): RubricDimensionPriority =>
  value === "essential" || value === "supporting" ? value : "important";

const knownFeedbackVisibility = (value: unknown): RubricFeedbackVisibility =>
  value === "company_only" || value === "reviewer_private"
    ? value
    : "talent_and_company";

const knownDescriptorLevel = (value: unknown): RubricDescriptorLevel | null =>
  value === "not_demonstrated" ||
  value === "emerging" ||
  value === "working_in_context" ||
  value === "independent_in_context" ||
  value === "advanced_in_context"
    ? value
    : null;

function descriptors(value: unknown): RubricDescriptor[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const level = knownDescriptorLevel(row?.level);
        const description = text(row?.description).slice(0, 500);
        return level && description ? [{ level, description }] : [];
      })
    : [];
}

function dimensions(value: unknown): RubricDimension[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const id = text(row?.id);
        const name = text(row?.name).slice(0, 120);
        const position = row?.position;
        const weight = row?.weight;
        if (
          !row ||
          !id ||
          !name ||
          typeof position !== "number" ||
          typeof weight !== "number"
        ) {
          return [];
        }
        return [
          {
            id,
            position,
            name,
            description: text(row.description).slice(0, 700),
            skillKeys: stringList(
              row.skill_keys,
              5
            ) as RubricDimension["skillKeys"],
            weight,
            priority: knownPriority(row.priority),
            observableCriteria: stringList(row.observable_criteria, 6),
            evidenceExamples: stringList(row.evidence_examples, 5),
            commonFailureModes: stringList(row.common_failure_modes, 5),
            reviewerGuidance: text(row.reviewer_guidance).slice(0, 900),
            feedbackVisibility: knownFeedbackVisibility(
              row.feedback_visibility
            ),
            descriptors: descriptors(row.descriptors),
          },
        ];
      })
    : [];
}

function calibrationExamples(value: unknown): RubricCalibrationExample[] {
  return Array.isArray(value)
    ? value.flatMap(item => {
        const row = record(item);
        const id = text(row?.id);
        const title = text(row?.title).slice(0, 140);
        const position = row?.position;
        if (!row || !id || !title || typeof position !== "number") return [];
        return [
          {
            id,
            position,
            title,
            description: text(row.description).slice(0, 700),
            sourceUrl: text(row.source_url).slice(0, 500),
            reviewerGuidance: text(row.reviewer_guidance).slice(0, 700),
          },
        ];
      })
    : [];
}

function rubricVersion(value: unknown): RubricVersion | null {
  const row = record(value);
  const id = text(row?.id);
  const versionNumber = row?.version_number;
  if (!row || !id || typeof versionNumber !== "number") return null;
  return {
    id,
    versionNumber,
    state: knownVersionState(row.state),
    title: text(row.title).slice(0, 120),
    projectContext: text(row.project_context).slice(0, 900),
    templateKey: text(row.template_key, "custom").slice(0, 60),
    dimensions: dimensions(row.dimensions),
    calibrationExamples: calibrationExamples(row.calibration_examples),
    createdAt: text(row.created_at) || null,
    publishedAt: text(row.published_at) || null,
    lockedAt: text(row.locked_at) || null,
  };
}

function rubric(value: unknown): ProjectRubric | null {
  const row = record(value);
  const id = text(row?.id);
  const projectId = text(row?.project_id);
  const organizationId = text(row?.organization_id);
  if (!row || !id || !projectId || !organizationId) return null;
  const versions: RubricVersion[] = Array.isArray(row.versions)
    ? row.versions.reduce<RubricVersion[]>((collected, item) => {
        const parsed = rubricVersion(item);
        if (parsed) collected.push(parsed);
        return collected;
      }, [])
    : [];
  const currentVersionId = text(row.current_version_id);
  const currentVersion =
    versions.find(version => version.id === currentVersionId) ??
    versions[0] ??
    null;
  return {
    id,
    projectId,
    organizationId,
    state: knownRubricState(row.state),
    currentVersion,
    versionHistory: versions,
    archivedAt: text(row.archived_at) || null,
    updatedAt: text(row.updated_at) || null,
    canEdit: false,
    canPublish: false,
  };
}

/** Returns only a caller-authorized organization rubric; missing or forbidden records look identical. */
export async function getCompanyProjectRubric(
  projectId: string,
  permissions: Readonly<{ canEdit: boolean; canPublish: boolean }>
): Promise<ProjectRubric | null> {
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !permissions.canEdit) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_company_project_rubric", {
    requested_project_id: projectId,
  });
  if (error) return null;
  const parsed = rubric(data);
  return parsed
    ? {
        ...parsed,
        canEdit: permissions.canEdit,
        canPublish: permissions.canPublish,
      }
    : null;
}

export function emptyProjectRubric(
  projectId: string,
  organizationId: string,
  permissions: Readonly<{ canEdit: boolean; canPublish: boolean }>
): ProjectRubric {
  return {
    id: "",
    projectId,
    organizationId,
    state: "draft",
    currentVersion: null,
    versionHistory: [],
    archivedAt: null,
    updatedAt: null,
    canEdit: permissions.canEdit,
    canPublish: permissions.canPublish,
  };
}
