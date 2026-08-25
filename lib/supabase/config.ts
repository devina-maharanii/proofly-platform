/**
 * Proofly Phase 11 auth boundary: only Supabase URL and publishable key can
 * cross the browser boundary. Privileged credentials are intentionally absent.
 */
export type PublicSupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

function isHttpsUrl(value: string | undefined): value is string {
  return Boolean(value && /^https:\/\/[^\s]+$/i.test(value));
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!isHttpsUrl(url) || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getTrustedAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  return isHttpsUrl(configuredUrl) ? configuredUrl : "http://localhost:3000";
}

export const googleOAuthEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";
