import { describe, expect, it } from "vitest";

import { mapSupabaseAuthError } from "@/lib/auth/errors";
import { createAuthRateLimiter } from "@/lib/auth/rate-limit";
import { authCallbackUrl, safeAuthRedirect } from "@/lib/auth/redirects";
import {
  emailSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/validation";
import {
  authenticatedClaimsFixture,
  unverifiedAccountFixture,
  validRegistrationFixture,
} from "@/tests/fixtures/auth";

describe("Phase 11 authentication security contract", () => {
  it("validates registration server input and ignores client-supplied role and user identifiers", () => {
    const parsed = signUpSchema.parse({
      ...validRegistrationFixture,
      role: "admin",
      userId: authenticatedClaimsFixture.sub,
    });

    expect(parsed).toEqual(validRegistrationFixture);
    expect(
      signUpSchema.safeParse({ ...validRegistrationFixture, password: "short" })
        .success
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        ...validRegistrationFixture,
        confirmPassword: "different-password",
      }).success
    ).toBe(false);
  });

  it("keeps sign-in and recovery inputs bounded and validates password changes", () => {
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "x" }).success
    ).toBe(false);
    expect(
      emailSchema.safeParse({ email: unverifiedAccountFixture.email }).success
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        password: validRegistrationFixture.password,
        confirmPassword: "different-password",
      }).success
    ).toBe(false);
  });

  it("allows only known internal redirect destinations and never accepts external callback URLs", () => {
    expect(safeAuthRedirect("/auth/continue")).toBe("/auth/continue");
    expect(safeAuthRedirect("/reset-password?step=1")).toBe("/reset-password");
    expect(safeAuthRedirect("https://attacker.example/collect")).toBe(
      "/auth/continue"
    );
    expect(safeAuthRedirect("//attacker.example/collect")).toBe(
      "/auth/continue"
    );
    expect(safeAuthRedirect("/admin")).toBe("/auth/continue");
    expect(authCallbackUrl("/reset-password")).toBe(
      "http://localhost:3000/auth/callback?next=%2Freset-password"
    );
  });

  it("limits sign-in and recovery attempts without retaining raw identity material as a key", () => {
    let now = 1_000;
    const limiter = createAuthRateLimiter(() => now);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        limiter.check("sign-in", "alex@example.test", "192.0.2.4")
      ).toEqual({ ok: true });
    }
    expect(
      limiter.check("sign-in", "alex@example.test", "192.0.2.4")
    ).toMatchObject({
      ok: false,
      retryAfterSeconds: 600,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        limiter.check("password-reset", "alex@example.test", "192.0.2.4")
      ).toEqual({ ok: true });
    }
    expect(
      limiter.check("password-reset", "alex@example.test", "192.0.2.4")
    ).toMatchObject({
      ok: false,
      retryAfterSeconds: 3600,
    });

    now += 10 * 60 * 1000;
    expect(limiter.check("sign-in", "alex@example.test", "192.0.2.4")).toEqual({
      ok: true,
    });
  });

  it("maps unverified and invalid-login provider messages to useful, non-sensitive recovery copy", () => {
    expect(mapSupabaseAuthError("Email not confirmed")).toMatchObject({
      errorCode: "EMAIL_UNCONFIRMED",
      message: expect.stringContaining("Confirm your email"),
    });
    expect(mapSupabaseAuthError("Invalid login credentials").message).toContain(
      "could not sign you in"
    );
    expect(
      mapSupabaseAuthError("arbitrary provider issue").message
    ).not.toContain("arbitrary provider issue");
  });
});
