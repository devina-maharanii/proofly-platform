/**
 * Phase 19 — GitHub integration readers.
 * Private settings use owner-scoped RLS records; public profiles use only the
 * database public-reader function for Talent-selected repository context.
 */
import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidPublicHandle } from "@/lib/profile/handle";

import {
  emptyGithubIntegrationContext,
  type GithubConnectionStatus,
  type GithubIntegrationContext,
  type GithubRepositoryContext,
  type GithubSyncStatus,
  type GithubSyncSummary,
  type PublicGithubContext,
  type PublicGithubRepositoryContext,
} from "./types";

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown, maximum: number) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === "string").slice(0, maximum)
    : [];
}

function connectionStatus(value: unknown): GithubConnectionStatus | null {
  return [
    "pending_authorization",
    "importing",
    "connected",
    "partially_synced",
    "rate_limited",
    "failed",
    "revoked",
  ].includes(stringValue(value))
    ? (value as GithubConnectionStatus)
    : null;
}

function syncStatus(value: unknown): GithubSyncStatus | null {
  return [
    "queued",
    "running",
    "succeeded",
    "partial",
    "rate_limited",
    "failed",
    "revoked",
  ].includes(stringValue(value))
    ? (value as GithubSyncStatus)
    : null;
}

function normalizeRepository(
  row: Record<string, unknown>
): GithubRepositoryContext | null {
  const id = stringValue(row.id);
  const sourceUrl = stringValue(row.source_url);
  if (!id || !/^https:\/\/github\.com\//.test(sourceUrl)) return null;
  return {
    id,
    repositoryName: stringValue(row.repository_name),
    fullName: stringValue(row.full_name),
    sourceUrl,
    description: stringValue(row.description),
    primaryLanguage: stringValue(row.primary_language),
    topics: stringList(row.topics, 20),
    contributionContext: stringValue(
      row.contribution_context,
      "Public repository selected by the Talent."
    ),
    isFork: row.is_fork === true,
    isArchived: row.is_archived === true,
    sourceUpdatedAt: nullableString(row.source_updated_at),
    sourceSyncedAt: stringValue(row.source_synced_at),
    selectedPublic: row.selected_public === true,
  };
}

function normalizeSync(
  row: Record<string, unknown> | null
): GithubSyncSummary | null {
  if (!row) return null;
  const status = syncStatus(row.status);
  const id = stringValue(row.id);
  const kind =
    row.sync_kind === "initial"
      ? "initial"
      : row.sync_kind === "manual"
        ? "manual"
        : null;
  if (!id || !status || !kind) return null;
  return {
    id,
    kind,
    status,
    repositoriesSeen: numberValue(row.repositories_seen),
    repositoriesImported: numberValue(row.repositories_imported),
    failureCode: stringValue(row.failure_code),
    retryAfterAt: nullableString(row.retry_after_at),
    createdAt: stringValue(row.created_at),
    completedAt: nullableString(row.completed_at),
  };
}

export async function getGithubIntegrationContext(
  userId: string
): Promise<GithubIntegrationContext> {
  void userId;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ...emptyGithubIntegrationContext, configured: false };
  const { data, error } = await supabase.rpc(
    "get_own_github_integration_context"
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return emptyGithubIntegrationContext;
  }
  const connection = data as Record<string, unknown>;
  const status = connectionStatus(connection.status);
  if (!status) return emptyGithubIntegrationContext;
  const latestSync =
    connection.latest_sync &&
    typeof connection.latest_sync === "object" &&
    !Array.isArray(connection.latest_sync)
      ? normalizeSync(connection.latest_sync as Record<string, unknown>)
      : null;
  return {
    configured: true,
    connected: status !== "revoked",
    status,
    username: stringValue(connection.github_login),
    profileUrl: stringValue(connection.github_profile_url),
    avatarUrl: stringValue(connection.avatar_url),
    consentedAt: nullableString(connection.consented_at),
    lastSyncedAt: nullableString(connection.last_synced_at),
    retryAfterAt: nullableString(connection.retry_after_at),
    failureCode: stringValue(connection.failure_code),
    repositories: Array.isArray(connection.repositories)
      ? connection.repositories.flatMap(row =>
          row && typeof row === "object" && !Array.isArray(row)
            ? normalizeRepository(row as Record<string, unknown>)
              ? [normalizeRepository(row as Record<string, unknown>)!]
              : []
            : []
        )
      : [],
    latestSync,
  };
}

function normalizePublicRepository(
  row: Record<string, unknown>
): PublicGithubRepositoryContext | null {
  const sourceUrl = stringValue(row.source_url);
  if (!sourceUrl || !/^https:\/\/github\.com\//.test(sourceUrl)) return null;
  return {
    repositoryName: stringValue(row.name),
    fullName: stringValue(row.full_name),
    sourceUrl,
    description: stringValue(row.description),
    primaryLanguage: stringValue(row.primary_language),
    topics: stringList(row.topics, 20),
    contributionContext: stringValue(
      row.contribution_context,
      "Public repository selected by the Talent."
    ),
    isFork: row.is_fork === true,
    isArchived: row.is_archived === true,
    sourceUpdatedAt: nullableString(row.source_updated_at),
    sourceSyncedAt: stringValue(row.source_synced_at),
    source: "github",
    contextStatus: "not_verified",
  };
}

export async function getPublicGithubContext(
  handle: string
): Promise<PublicGithubContext | null> {
  if (!isValidPublicHandle(handle)) return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(
    "get_public_talent_github_context",
    {
      requested_handle: handle,
    }
  );
  if (error || !data || typeof data !== "object" || Array.isArray(data))
    return null;
  const row = data as Record<string, unknown>;
  const username = stringValue(row.username);
  const profileUrl = stringValue(row.profile_url);
  if (!username || !/^https:\/\/github\.com\//.test(profileUrl)) return null;
  return {
    username,
    profileUrl,
    avatarUrl: stringValue(row.avatar_url),
    lastSyncedAt: nullableString(row.last_synced_at),
    source: "github",
    contextStatus: "not_verified",
    repositories: Array.isArray(row.repositories)
      ? row.repositories.flatMap(repository =>
          repository &&
          typeof repository === "object" &&
          !Array.isArray(repository)
            ? normalizePublicRepository(repository as Record<string, unknown>)
              ? [
                  normalizePublicRepository(
                    repository as Record<string, unknown>
                  )!,
                ]
              : []
            : []
        )
      : [],
  };
}
