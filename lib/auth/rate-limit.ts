/** Proofly Phase 11: small server-side auth throttle keyed by hashed request context, never logged. */
import { createHash } from "node:crypto";

export type AuthRateLimitAction =
  | "sign-in"
  | "sign-up"
  | "password-reset"
  | "password-update"
  | "verification-resend";

type RateLimitRecord = { count: number; resetAt: number };

export type AuthRateLimiter = {
  check(
    action: AuthRateLimitAction,
    identity: string,
    address: string
  ): { ok: true } | { ok: false; retryAfterSeconds: number };
};

const policy: Record<AuthRateLimitAction, { limit: number; windowMs: number }> =
  {
    "sign-in": { limit: 5, windowMs: 10 * 60 * 1000 },
    "sign-up": { limit: 5, windowMs: 60 * 60 * 1000 },
    "password-reset": { limit: 3, windowMs: 60 * 60 * 1000 },
    "password-update": { limit: 5, windowMs: 15 * 60 * 1000 },
    "verification-resend": { limit: 3, windowMs: 60 * 60 * 1000 },
  };

function hashKey(
  action: AuthRateLimitAction,
  identity: string,
  address: string
) {
  return createHash("sha256")
    .update(`${action}:${identity.trim().toLowerCase()}:${address}`)
    .digest("base64url");
}

export function createAuthRateLimiter(now = () => Date.now()): AuthRateLimiter {
  const records = new Map<string, RateLimitRecord>();

  return {
    check(action, identity, address) {
      const key = hashKey(action, identity, address);
      const currentTime = now();
      const rule = policy[action];
      const existing = records.get(key);

      if (!existing || existing.resetAt <= currentTime) {
        records.set(key, { count: 1, resetAt: currentTime + rule.windowMs });
        return { ok: true };
      }

      if (existing.count >= rule.limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.resetAt - currentTime) / 1000)
          ),
        };
      }

      existing.count += 1;
      return { ok: true };
    },
  };
}

export const authRateLimiter = createAuthRateLimiter();
