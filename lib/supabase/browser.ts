/**
 * Proofly Phase 11 auth boundary: browser access is limited to a publishable
 * Supabase client for approved session-aware interactions.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function createBrowserSupabaseClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return null;
  }

  browserClient ??= createBrowserClient(config.url, config.publishableKey);
  return browserClient;
}
