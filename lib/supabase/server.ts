/**
 * Proofly Phase 11 auth boundary: request-scoped server client; use verified
 * claims for authorization and never import service-role credentials here.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseConfig } from "./config";

export async function createServerSupabaseClient() {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. proxy.ts refreshes them.
        }
      },
    },
  });
}

export type VerifiedAuthSession = Readonly<{
  userId: string;
  email: string | null;
}>;

export async function getVerifiedAuthSession(): Promise<VerifiedAuthSession | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string") {
    return null;
  }

  const email = claims?.email;
  return {
    userId: subject,
    email: typeof email === "string" ? email : null,
  };
}
