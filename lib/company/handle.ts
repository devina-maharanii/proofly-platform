/** Phase 21 handle policy: public company routes reserve application namespaces and reuse the stable organization slug. */
const publicCompanyHandlePattern = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

const reservedCompanyHandles = new Set([
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "companies",
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
]);

export function normalizeCompanyHandle(value: string) {
  return value.trim().toLowerCase();
}

export function isValidCompanyHandle(value: string) {
  return publicCompanyHandlePattern.test(normalizeCompanyHandle(value));
}

export function isReservedCompanyHandle(value: string) {
  return reservedCompanyHandles.has(normalizeCompanyHandle(value));
}

export { publicCompanyHandlePattern };
