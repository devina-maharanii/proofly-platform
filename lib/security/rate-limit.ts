/** Proofly Phase 15: server-only high-risk request limiter keyed by hashed actor and address; production scale requires a durable shared store. */
import { createHash } from "node:crypto";

export type SecurityRateLimitAction =
  | "sensitive-account"
  | "mutation"
  | "search"
  | "message"
  | "upload"
  | "webhook";

type RateLimitRecord = { count: number; resetAt: number };
type Rule = Readonly<{ limit: number; windowMs: number }>;

const policy: Record<SecurityRateLimitAction, Rule> = {
  "sensitive-account": { limit: 5, windowMs: 15 * 60 * 1000 },
  mutation: { limit: 30, windowMs: 10 * 60 * 1000 },
  search: { limit: 60, windowMs: 60 * 1000 },
  message: { limit: 20, windowMs: 10 * 60 * 1000 },
  upload: { limit: 10, windowMs: 60 * 60 * 1000 },
  webhook: { limit: 120, windowMs: 60 * 1000 },
};

export type SecurityRateLimiter = Readonly<{
  check: (
    action: SecurityRateLimitAction,
    subject: string,
    address: string
  ) => { ok: true } | { ok: false; retryAfterSeconds: number };
}>;

function keyFor(
  action: SecurityRateLimitAction,
  subject: string,
  address: string
) {
  return createHash("sha256")
    .update(`${action}:${subject.trim().toLowerCase()}:${address.trim()}`)
    .digest("base64url");
}

export function createSecurityRateLimiter(
  now = () => Date.now()
): SecurityRateLimiter {
  const records = new Map<string, RateLimitRecord>();
  return {
    check(action, subject, address) {
      const key = keyFor(action, subject, address);
      const rule = policy[action];
      const currentTime = now();
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

export const securityRateLimiter = createSecurityRateLimiter();
