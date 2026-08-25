/** Synthetic Phase 11 fixtures; never use real accounts, passwords, tokens, or customer data in tests. */
export const validRegistrationFixture = {
  email: "alex@example.test",
  password: "correct-horse-battery-staple",
  confirmPassword: "correct-horse-battery-staple",
} as const;

export const authenticatedClaimsFixture = {
  sub: "00000000-0000-4000-8000-000000000001",
  email: "alex@example.test",
} as const;

export const unverifiedAccountFixture = {
  email: "pending@example.test",
} as const;
