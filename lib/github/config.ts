/**
 * Phase 19 — GitHub integration boundary.
 * The browser may use only the public Supabase connection. GitHub OAuth
 * credentials and per-Talent tokens exist exclusively in the Edge Function.
 */
import "server-only";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function getGithubIntegrationFunctionUrl(): string | null {
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  return `${config.url}/functions/v1/github-integration`;
}

export function getGithubIntegrationPublishableKey(): string | null {
  return getPublicSupabaseConfig()?.publishableKey ?? null;
}
