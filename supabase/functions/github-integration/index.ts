import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const githubApiBase = "https://api.github.com";
const githubAuthorizeUrl = "https://github.com/login/oauth/authorize";
const githubTokenUrl = "https://github.com/login/oauth/access_token";
const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

type GithubTokenResponse = Readonly<{
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
}>;

type GithubUser = Readonly<{
  id: number;
  login: string;
  avatar_url?: string;
  html_url?: string;
}>;

type GithubRepository = Readonly<{
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  fork?: boolean;
  archived?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
}>;

type GithubConnection = Readonly<{
  id: string;
  user_id: string;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  access_token_expires_at: string | null;
}>;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function randomValue(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function sha256(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("configuration_unavailable");
  return value;
}

function serviceRoleKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;
  const encoded = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (encoded) {
    try {
      const keys = JSON.parse(encoded) as Record<string, unknown>;
      if (typeof keys.default === "string" && keys.default) return keys.default;
    } catch {
      // Fall through to the configuration error without logging any secret value.
    }
  }
  throw new Error("configuration_unavailable");
}

function publishableKey(): string {
  const direct =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ??
    Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (direct) return direct;
  const encoded = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (encoded) {
    try {
      const keys = JSON.parse(encoded) as Record<string, unknown>;
      if (typeof keys.default === "string" && keys.default) return keys.default;
    } catch {
      // Preserve the generic safe configuration error.
    }
  }
  throw new Error("configuration_unavailable");
}

function appUrl(): string {
  const value = requiredEnvironment("PROOFLY_APP_URL");
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("configuration_unavailable");
  return url.origin;
}

function callbackUrl(): string {
  return `${requiredEnvironment("SUPABASE_URL")}/functions/v1/github-integration/callback`;
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = requiredEnvironment("GITHUB_TOKEN_ENCRYPTION_KEY");
  const keyBytes = bytesFromBase64Url(raw);
  if (keyBytes.byteLength !== 32) throw new Error("configuration_unavailable");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(value: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await encryptionKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value)
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string): Promise<string> {
  const [ivPart, cipherPart] = value.split(".");
  if (!ivPart || !cipherPart) throw new Error("token_invalid");
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromBase64Url(ivPart) },
    key,
    bytesFromBase64Url(cipherPart)
  );
  return new TextDecoder().decode(decrypted);
}

function nowPlus(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function redirect(path: string, status = 303) {
  return Response.redirect(new URL(path, appUrl()), status);
}

function safeFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return [
    "configuration_unavailable",
    "unexpected_scope",
    "authorization_denied",
    "token_invalid",
    "rate_limited",
    "partial_failure",
    "provider_unavailable",
  ].includes(message)
    ? message
    : "provider_unavailable";
}

function getRetryAfter(response: Response): string | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return nowPlus(Number(retryAfter));
  const reset = response.headers.get("x-ratelimit-reset");
  if (reset && /^\d+$/.test(reset)) {
    const date = new Date(Number(reset) * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  try {
    return origin && new URL(origin).origin === appUrl()
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {};
  } catch {
    return {};
  }
}

function serviceClient() {
  return createClient(requiredEnvironment("SUPABASE_URL"), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;
  const client = createClient(
    requiredEnvironment("SUPABASE_URL"),
    publishableKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { userId: data.user.id, token };
}

async function requireTalent(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return null;
  const service = serviceClient();
  const { data } = await service
    .from("active_contexts")
    .select("user_id")
    .eq("user_id", user.userId)
    .eq("active_role", "talent")
    .is("active_organization_id", null)
    .maybeSingle();
  return data ? user : null;
}

async function recordEvent(
  service: ReturnType<typeof serviceClient>,
  userId: string,
  connectionId: string | null,
  eventType: string
) {
  await service.from("github_integration_events").insert({
    user_id: userId,
    connection_id: connectionId,
    event_type: eventType,
  });
}

async function githubTokenRequest(parameters: URLSearchParams) {
  const response = await fetch(githubTokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
  });
  if (!response.ok) throw new Error("provider_unavailable");
  const body = (await response.json()) as GithubTokenResponse;
  if (!body.access_token || body.error) throw new Error("authorization_denied");
  if (body.scope?.trim()) throw new Error("unexpected_scope");
  return body as Required<Pick<GithubTokenResponse, "access_token">> & GithubTokenResponse;
}

async function revokeGithubToken(accessToken: string | null) {
  if (!accessToken) return;
  try {
    const clientId = requiredEnvironment("GITHUB_OAUTH_CLIENT_ID");
    const clientSecret = requiredEnvironment("GITHUB_OAUTH_CLIENT_SECRET");
    await fetch(`${githubApiBase}/applications/${encodeURIComponent(clientId)}/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch {
    // Local token/data removal still completes and is the authoritative Proofly revocation boundary.
  }
}

async function githubFetch(
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${githubApiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (response.status === 401) throw new Error("token_invalid");
  if (response.status === 403 || response.status === 429) {
    const retryAfter = getRetryAfter(response);
    const error = new Error("rate_limited") as Error & { retryAfter?: string | null };
    error.retryAfter = retryAfter;
    throw error;
  }
  if (!response.ok) throw new Error("provider_unavailable");
  return response;
}

async function currentAccessToken(
  service: ReturnType<typeof serviceClient>,
  connection: GithubConnection
) {
  if (!connection.encrypted_access_token) throw new Error("token_invalid");
  const expiration = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : Number.POSITIVE_INFINITY;
  if (expiration > Date.now() + 60_000) return decrypt(connection.encrypted_access_token);
  if (!connection.encrypted_refresh_token) throw new Error("token_invalid");
  const refreshToken = await decrypt(connection.encrypted_refresh_token);
  const refreshed = await githubTokenRequest(
    new URLSearchParams({
      client_id: requiredEnvironment("GITHUB_OAUTH_CLIENT_ID"),
      client_secret: requiredEnvironment("GITHUB_OAUTH_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  const update: Record<string, unknown> = {
    encrypted_access_token: await encrypt(refreshed.access_token),
    access_token_expires_at:
      typeof refreshed.expires_in === "number" ? nowPlus(refreshed.expires_in) : null,
    updated_at: new Date().toISOString(),
  };
  if (refreshed.refresh_token) {
    update.encrypted_refresh_token = await encrypt(refreshed.refresh_token);
    update.refresh_token_expires_at =
      typeof refreshed.refresh_token_expires_in === "number"
        ? nowPlus(refreshed.refresh_token_expires_in)
        : null;
  }
  await service.from("github_connections").update(update).eq("id", connection.id);
  return refreshed.access_token;
}

async function finishSyncFailure(
  service: ReturnType<typeof serviceClient>,
  connection: GithubConnection,
  runId: string,
  error: unknown
) {
  const code = safeFailureCode(error);
  const retryAfter =
    error && typeof error === "object" && "retryAfter" in error
      ? (error as { retryAfter?: string | null }).retryAfter ?? null
      : null;
  const runStatus = code === "rate_limited" ? "rate_limited" : "failed";
  const connectionStatus = code === "rate_limited" ? "rate_limited" : "failed";
  await Promise.all([
    service
      .from("github_sync_runs")
      .update({
        status: runStatus,
        failure_code: code,
        retry_after_at: retryAfter,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId),
    service
      .from("github_connections")
      .update({
        status: connectionStatus,
        failure_code: code,
        retry_after_at: retryAfter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id),
  ]);
  await recordEvent(
    service,
    connection.user_id,
    connection.id,
    code === "rate_limited" ? "github.sync_rate_limited" : "github.sync_failed"
  );
}

async function synchronize(connectionId: string, runId: string) {
  const service = serviceClient();
  const { data: connection } = await service
    .from("github_connections")
    .select("id, user_id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at")
    .eq("id", connectionId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!connection) return;
  const typedConnection = connection as GithubConnection;
  await service
    .from("github_sync_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "queued");
  try {
    const token = await currentAccessToken(service, typedConnection);
    const [userResponse, repositoriesResponse, exclusionsResponse, existingResponse] =
      await Promise.all([
        githubFetch(token, "/user"),
        githubFetch(token, "/user/repos?visibility=public&affiliation=owner&sort=updated&direction=desc&per_page=100&page=1"),
        service
          .from("github_repository_exclusions")
          .select("github_repository_id")
          .eq("connection_id", connectionId),
        service
          .from("github_repository_snapshots")
          .select("github_repository_id, selected_public, hidden_at")
          .eq("connection_id", connectionId)
          .is("removed_at", null),
      ]);
    const githubUser = (await userResponse.json()) as GithubUser;
    const repositories = ((await repositoriesResponse.json()) as GithubRepository[]).filter(
      repository =>
        Number.isSafeInteger(repository.id) &&
        typeof repository.name === "string" &&
        typeof repository.full_name === "string" &&
        /^https:\/\/github\.com\//.test(repository.html_url)
    );
    const excluded = new Set(
      (exclusionsResponse.data ?? []).map(row => row.github_repository_id as number)
    );
    const existing = new Map(
      (existingResponse.data ?? []).map(row => [
        row.github_repository_id as number,
        { selectedPublic: row.selected_public === true, hiddenAt: row.hidden_at as string | null },
      ])
    );
    const imported = repositories.filter(repository => !excluded.has(repository.id));
    const snapshotRows = imported.map(repository => {
      const current = existing.get(repository.id);
      return {
        connection_id: connectionId,
        user_id: typedConnection.user_id,
        github_repository_id: repository.id,
        repository_name: repository.name.slice(0, 100),
        full_name: repository.full_name.slice(0, 200),
        source_url: repository.html_url,
        description: (repository.description ?? "").slice(0, 500),
        primary_language: (repository.language ?? "").slice(0, 100),
        topics: Array.isArray(repository.topics)
          ? repository.topics.filter(topic => typeof topic === "string").slice(0, 20)
          : [],
        contribution_context: "GitHub identifies this account as the public repository owner.",
        is_fork: repository.fork === true,
        is_archived: repository.archived === true,
        source_created_at: repository.created_at ?? null,
        source_updated_at: repository.updated_at ?? null,
        source_pushed_at: repository.pushed_at ?? null,
        source_synced_at: new Date().toISOString(),
        selected_public: current?.selectedPublic ?? false,
        hidden_at: current?.hiddenAt ?? null,
        removed_at: null,
        updated_at: new Date().toISOString(),
      };
    });
    if (snapshotRows.length) {
      const { error } = await service
        .from("github_repository_snapshots")
        .upsert(snapshotRows, { onConflict: "connection_id,github_repository_id" });
      if (error) throw new Error("partial_failure");
    }
    const importedIds = new Set(imported.map(repository => repository.id));
    const staleIds = [...existing.keys()].filter(id => !importedIds.has(id));
    if (staleIds.length) {
      await service
        .from("github_repository_snapshots")
        .update({ selected_public: false, removed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("connection_id", connectionId)
        .in("github_repository_id", staleIds);
    }
    const partial = repositories.length !== imported.length;
    const finishedAt = new Date().toISOString();
    await Promise.all([
      service
        .from("github_connections")
        .update({
          github_user_id: githubUser.id,
          github_login: githubUser.login.slice(0, 39),
          github_profile_url: (githubUser.html_url ?? "").slice(0, 500),
          avatar_url: (githubUser.avatar_url ?? "").slice(0, 500),
          status: partial ? "partially_synced" : "connected",
          last_synced_at: finishedAt,
          retry_after_at: null,
          failure_code: partial ? "partial_failure" : "",
          updated_at: finishedAt,
        })
        .eq("id", connectionId),
      service
        .from("github_sync_runs")
        .update({
          status: partial ? "partial" : "succeeded",
          repositories_seen: repositories.length,
          repositories_imported: imported.length,
          failure_code: partial ? "partial_failure" : "",
          completed_at: finishedAt,
        })
        .eq("id", runId),
    ]);
    await recordEvent(
      service,
      typedConnection.user_id,
      connectionId,
      partial ? "github.sync_partial" : "github.sync_succeeded"
    );
  } catch (error) {
    await finishSyncFailure(service, typedConnection, runId, error);
  }
}

async function begin(request: Request) {
  const actor = await requireTalent(request);
  if (!actor) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  try {
    const state = randomValue();
    const codeVerifier = randomValue(48);
    const codeChallenge = base64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)))
    );
    const service = serviceClient();
    await service
      .from("github_oauth_attempts")
      .delete()
      .eq("user_id", actor.userId)
      .is("consumed_at", null);
    const { error } = await service.from("github_oauth_attempts").insert({
      user_id: actor.userId,
      state_hash: await sha256(state),
      encrypted_payload: await encrypt(JSON.stringify({ codeVerifier })),
      expires_at: nowPlus(600),
    });
    if (error) throw new Error("provider_unavailable");
    await recordEvent(service, actor.userId, null, "github.authorization_started");
    const authorization = new URL(githubAuthorizeUrl);
    authorization.search = new URLSearchParams({
      client_id: requiredEnvironment("GITHUB_OAUTH_CLIENT_ID"),
      redirect_uri: callbackUrl(),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return json({ authorizationUrl: authorization.toString() });
  } catch (error) {
    return json({ error: safeFailureCode(error) }, 503);
  }
}

async function callback(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (providerError || !state || !code) return redirect("/settings?github=denied");
  try {
    const service = serviceClient();
    const { data: attempt } = await service
      .from("github_oauth_attempts")
      .select("id, user_id, encrypted_payload, expires_at, consumed_at")
      .eq("state_hash", await sha256(state))
      .maybeSingle();
    if (!attempt || attempt.consumed_at || new Date(attempt.expires_at).getTime() <= Date.now()) {
      return redirect("/settings?github=invalid");
    }
    const { codeVerifier } = JSON.parse(await decrypt(attempt.encrypted_payload)) as { codeVerifier?: string };
    if (!codeVerifier) return redirect("/settings?github=invalid");
    const token = await githubTokenRequest(
      new URLSearchParams({
        client_id: requiredEnvironment("GITHUB_OAUTH_CLIENT_ID"),
        client_secret: requiredEnvironment("GITHUB_OAUTH_CLIENT_SECRET"),
        code,
        redirect_uri: callbackUrl(),
        code_verifier: codeVerifier,
      })
    );
    const userResponse = await githubFetch(token.access_token, "/user");
    const githubUser = (await userResponse.json()) as GithubUser;
    if (!Number.isSafeInteger(githubUser.id) || !githubUser.login) throw new Error("provider_unavailable");
    const now = new Date().toISOString();
    const { data: connection, error } = await service
      .from("github_connections")
      .upsert(
        {
          user_id: attempt.user_id,
          github_user_id: githubUser.id,
          github_login: githubUser.login.slice(0, 39),
          github_profile_url: (githubUser.html_url ?? "").slice(0, 500),
          avatar_url: (githubUser.avatar_url ?? "").slice(0, 500),
          encrypted_access_token: await encrypt(token.access_token),
          encrypted_refresh_token: token.refresh_token ? await encrypt(token.refresh_token) : null,
          access_token_expires_at: typeof token.expires_in === "number" ? nowPlus(token.expires_in) : null,
          refresh_token_expires_at: typeof token.refresh_token_expires_in === "number" ? nowPlus(token.refresh_token_expires_in) : null,
          consented_at: now,
          status: "importing",
          retry_after_at: null,
          failure_code: "",
          revoked_at: null,
          data_deleted_at: null,
          updated_at: now,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();
    if (error || !connection) throw new Error("provider_unavailable");
    await service
      .from("github_oauth_attempts")
      .update({ consumed_at: now })
      .eq("id", attempt.id)
      .is("consumed_at", null);
    const { data: run, error: runError } = await service
      .from("github_sync_runs")
      .insert({
        connection_id: connection.id,
        user_id: attempt.user_id,
        sync_kind: "initial",
        idempotency_key: crypto.randomUUID(),
        status: "queued",
      })
      .select("id")
      .single();
    if (runError || !run) throw new Error("provider_unavailable");
    await Promise.all([
      recordEvent(service, attempt.user_id, connection.id, "github.connected"),
      recordEvent(service, attempt.user_id, connection.id, "github.initial_sync_queued"),
    ]);
    EdgeRuntime.waitUntil(synchronize(connection.id, run.id));
    return redirect("/settings?github=importing");
  } catch (error) {
    return redirect(`/settings?github=${safeFailureCode(error)}`);
  }
}

async function manualSync(request: Request) {
  const actor = await requireTalent(request);
  if (!actor) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  try {
    const service = serviceClient();
    const { data: connection } = await service
      .from("github_connections")
      .select("id, user_id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at, status, revoked_at")
      .eq("user_id", actor.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (!connection) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
    if (connection.status === "importing") return json({ error: "CONFLICT" }, 409);
    const idempotencyKey = request.headers.get("idempotency-key");
    const key = idempotencyKey && /^[0-9a-f-]{36}$/i.test(idempotencyKey) ? idempotencyKey : crypto.randomUUID();
    const { data: run, error } = await service
      .from("github_sync_runs")
      .upsert(
        {
          connection_id: connection.id,
          user_id: actor.userId,
          sync_kind: "manual",
          idempotency_key: key,
          status: "queued",
        },
        { onConflict: "connection_id,idempotency_key", ignoreDuplicates: true }
      )
      .select("id, status")
      .maybeSingle();
    const selectedRun = run ?? (await service
      .from("github_sync_runs")
      .select("id, status")
      .eq("connection_id", connection.id)
      .eq("idempotency_key", key)
      .maybeSingle()).data;
    if (error || !selectedRun) throw new Error("provider_unavailable");
    if (selectedRun.status === "queued") {
      await recordEvent(service, actor.userId, connection.id, "github.manual_sync_queued");
      EdgeRuntime.waitUntil(synchronize(connection.id, selectedRun.id));
    }
    return json({ status: selectedRun.status === "queued" ? "queued" : selectedRun.status });
  } catch (error) {
    return json({ error: safeFailureCode(error) }, 503);
  }
}

async function repositoryMutation(request: Request, operation: "select" | "hide" | "remove") {
  const actor = await requireTalent(request);
  if (!actor) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  const body = await request.json().catch(() => null) as { repositoryId?: unknown } | null;
  const repositoryId = typeof body?.repositoryId === "string" ? body.repositoryId : "";
  if (!/^[0-9a-f-]{36}$/i.test(repositoryId)) return json({ error: "VALIDATION_FAILED" }, 400);
  const service = serviceClient();
  const { data: repository } = await service
    .from("github_repository_snapshots")
    .select("id, connection_id, github_repository_id")
    .eq("id", repositoryId)
    .eq("user_id", actor.userId)
    .is("removed_at", null)
    .maybeSingle();
  if (!repository) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  const now = new Date().toISOString();
  if (operation === "remove") {
    const [{ error: exclusionError }, { error: deleteError }] = await Promise.all([
      service.from("github_repository_exclusions").upsert({
        connection_id: repository.connection_id,
        user_id: actor.userId,
        github_repository_id: repository.github_repository_id,
        removed_at: now,
      }),
      service.from("github_repository_snapshots").delete().eq("id", repository.id).eq("user_id", actor.userId),
    ]);
    if (exclusionError || deleteError) return json({ error: "DEPENDENCY_UNAVAILABLE" }, 503);
    await recordEvent(service, actor.userId, repository.connection_id, "github.repository_removed");
  } else {
    const { error } = await service
      .from("github_repository_snapshots")
      .update({
        selected_public: operation === "select",
        hidden_at: operation === "hide" ? now : null,
        updated_at: now,
      })
      .eq("id", repository.id)
      .eq("user_id", actor.userId);
    if (error) return json({ error: "DEPENDENCY_UNAVAILABLE" }, 503);
    await recordEvent(
      service,
      actor.userId,
      repository.connection_id,
      operation === "select" ? "github.repository_selected" : "github.repository_hidden"
    );
  }
  return json({ status: "ok" });
}

async function disconnect(request: Request) {
  const actor = await requireTalent(request);
  if (!actor) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "DISCONNECT") return json({ error: "VALIDATION_FAILED" }, 400);
  const service = serviceClient();
  const { data: connection } = await service
    .from("github_connections")
    .select("id, encrypted_access_token")
    .eq("user_id", actor.userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!connection) return json({ error: "NOT_FOUND_OR_PRIVATE" }, 404);
  const now = new Date().toISOString();
  let providerToken: string | null = null;
  try {
    providerToken = connection.encrypted_access_token
      ? await decrypt(connection.encrypted_access_token)
      : null;
  } catch {
    providerToken = null;
  }
  await revokeGithubToken(providerToken);
  await Promise.all([
    service
      .from("github_repository_snapshots")
      .delete()
      .eq("connection_id", connection.id)
      .eq("user_id", actor.userId),
    service
      .from("github_repository_exclusions")
      .delete()
      .eq("connection_id", connection.id)
      .eq("user_id", actor.userId),
    service
      .from("github_connections")
      .update({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        github_login: "",
        github_profile_url: "",
        avatar_url: "",
        status: "revoked",
        revoked_at: now,
        data_deleted_at: now,
        retry_after_at: null,
        failure_code: "",
        updated_at: now,
      })
      .eq("id", connection.id)
      .eq("user_id", actor.userId),
  ]);
  await recordEvent(service, actor.userId, connection.id, "github.disconnected");
  return json({ status: "revoked" });
}

Deno.serve(async request => {
  const path = new URL(request.url).pathname.replace(/^.*\/github-integration/, "") || "/";
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, idempotency-key" },
    });
  }
  if (request.method === "GET" && path === "/callback") return callback(request);
  if (request.method === "POST" && path === "/begin") return begin(request);
  if (request.method === "POST" && path === "/manual-sync") return manualSync(request);
  if (request.method === "POST" && path === "/repositories/select") return repositoryMutation(request, "select");
  if (request.method === "POST" && path === "/repositories/hide") return repositoryMutation(request, "hide");
  if (request.method === "POST" && path === "/repositories/remove") return repositoryMutation(request, "remove");
  if (request.method === "POST" && path === "/disconnect") return disconnect(request);
  return json({ error: "NOT_FOUND" }, 404);
});
