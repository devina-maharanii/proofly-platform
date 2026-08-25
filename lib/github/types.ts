/**
 * Phase 19 — GitHub context is optional, source-labelled activity context.
 * It must never be represented as verified Proofly evidence or a skill score.
 */
export type GithubConnectionStatus =
  | "pending_authorization"
  | "importing"
  | "connected"
  | "partially_synced"
  | "rate_limited"
  | "failed"
  | "revoked";

export type GithubSyncStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "rate_limited"
  | "failed"
  | "revoked";

export type GithubRepositoryContext = Readonly<{
  id: string;
  repositoryName: string;
  fullName: string;
  sourceUrl: string;
  description: string;
  primaryLanguage: string;
  topics: readonly string[];
  contributionContext: string;
  isFork: boolean;
  isArchived: boolean;
  sourceUpdatedAt: string | null;
  sourceSyncedAt: string;
  selectedPublic: boolean;
}>;

export type GithubSyncSummary = Readonly<{
  id: string;
  kind: "initial" | "manual";
  status: GithubSyncStatus;
  repositoriesSeen: number;
  repositoriesImported: number;
  failureCode: string;
  retryAfterAt: string | null;
  createdAt: string;
  completedAt: string | null;
}>;

export type GithubIntegrationContext = Readonly<{
  configured: boolean;
  connected: boolean;
  status: GithubConnectionStatus | null;
  username: string;
  profileUrl: string;
  avatarUrl: string;
  consentedAt: string | null;
  lastSyncedAt: string | null;
  retryAfterAt: string | null;
  failureCode: string;
  repositories: readonly GithubRepositoryContext[];
  latestSync: GithubSyncSummary | null;
}>;

export type PublicGithubRepositoryContext = Readonly<{
  repositoryName: string;
  fullName: string;
  sourceUrl: string;
  description: string;
  primaryLanguage: string;
  topics: readonly string[];
  contributionContext: string;
  isFork: boolean;
  isArchived: boolean;
  sourceUpdatedAt: string | null;
  sourceSyncedAt: string;
  source: "github";
  contextStatus: "not_verified";
}>;

export type PublicGithubContext = Readonly<{
  username: string;
  profileUrl: string;
  avatarUrl: string;
  lastSyncedAt: string | null;
  source: "github";
  contextStatus: "not_verified";
  repositories: readonly PublicGithubRepositoryContext[];
}>;

export const emptyGithubIntegrationContext: GithubIntegrationContext = {
  configured: true,
  connected: false,
  status: null,
  username: "",
  profileUrl: "",
  avatarUrl: "",
  consentedAt: null,
  lastSyncedAt: null,
  retryAfterAt: null,
  failureCode: "",
  repositories: [],
  latestSync: null,
};
