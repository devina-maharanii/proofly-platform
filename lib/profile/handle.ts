/** Stable public-handle contract for Phase 20 profile routes. */
export const publicHandlePattern = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export const reservedPublicHandles = [
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "company",
  "dashboard",
  "discover",
  "evidence",
  "explore",
  "favicon",
  "get-started",
  "help",
  "login",
  "logout",
  "onboarding",
  "p",
  "privacy",
  "profile",
  "robots",
  "settings",
  "sign-in",
  "sign-up",
  "sitemap",
  "talent",
  "terms",
  "verify-email",
] as const;

export function normalizePublicHandle(value: string) {
  return value.trim().toLowerCase();
}

export function isReservedPublicHandle(value: string) {
  return reservedPublicHandles.includes(
    normalizePublicHandle(value) as (typeof reservedPublicHandles)[number]
  );
}

export function isValidPublicHandle(value: string) {
  const normalized = normalizePublicHandle(value);
  return (
    publicHandlePattern.test(normalized) && !isReservedPublicHandle(normalized)
  );
}
