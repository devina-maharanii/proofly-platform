import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canIssuePrivateFileAccess,
  maxPrivateFileBytes,
  privateStorageBucket,
  validatePrivateFileUpload,
  validatePrivateSignedUrlExpiry,
  type PrivateFileMetadata,
} from "@/lib/security/file-access";
import { createSecurityRateLimiter } from "@/lib/security/rate-limit";
import {
  createWebhookReplayGuard,
  verifyWebhookSignature,
} from "@/lib/security/webhook";

const cleanFile: PrivateFileMetadata = {
  bucket: privateStorageBucket,
  objectKey: "owner-user/evidence/portfolio.pdf",
  contentType: "application/pdf",
  sizeBytes: 512,
  ownerUserId: "owner-user",
  scanState: "clean",
};

describe("Phase 15 file, webhook, and rate-limit contracts", () => {
  it("rejects public, cross-owner, traversing, unsupported, and oversized file candidates", () => {
    expect(validatePrivateFileUpload(cleanFile)).toEqual({ ok: true });
    expect(
      validatePrivateFileUpload({ ...cleanFile, bucket: "public" })
    ).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
    });
    expect(
      validatePrivateFileUpload({
        ...cleanFile,
        objectKey: "other-user/file.pdf",
      })
    ).toEqual({ ok: false, code: "VALIDATION_FAILED" });
    expect(
      validatePrivateFileUpload({
        ...cleanFile,
        objectKey: "owner-user/../file.pdf",
      })
    ).toEqual({ ok: false, code: "VALIDATION_FAILED" });
    expect(
      validatePrivateFileUpload({
        ...cleanFile,
        contentType: "application/zip",
      })
    ).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
    });
    expect(
      validatePrivateFileUpload({
        ...cleanFile,
        sizeBytes: maxPrivateFileBytes + 1,
      })
    ).toEqual({ ok: false, code: "VALIDATION_FAILED" });
    expect(validatePrivateSignedUrlExpiry(301)).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
    });
    expect(validatePrivateSignedUrlExpiry(300)).toEqual({ ok: true });
  });

  it("requires clean scan and current resource authorization before private file access", () => {
    const owner = {
      userId: "owner-user",
      activeRole: "talent" as const,
      activeOrganizationId: null,
      companyPermissions: [],
      capabilities: ["talent"] as const,
    };
    const resource = {
      ownerUserId: "owner-user",
      organizationId: null,
      visibility: "private" as const,
    };

    expect(canIssuePrivateFileAccess(owner, resource, cleanFile)).toEqual({
      ok: true,
    });
    expect(
      canIssuePrivateFileAccess(owner, resource, {
        ...cleanFile,
        scanState: "pending",
      })
    ).toEqual({ ok: false, code: "NOT_FOUND_OR_PRIVATE" });
    expect(
      canIssuePrivateFileAccess(
        { ...owner, userId: "attacker" },
        resource,
        cleanFile
      )
    ).toEqual({ ok: false, code: "NOT_FOUND_OR_PRIVATE" });
  });

  it("uses timestamped timing-safe HMAC verification and replay-safe event identifiers", () => {
    const rawBody = '{"event":"approved"}';
    const secret = "test-secret";
    const timestamp = "1724544000";
    const signature = `sha256=${createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")}`;

    expect(
      verifyWebhookSignature({
        rawBody,
        signature,
        timestamp,
        secret,
        now: 1724544000_000,
      })
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        rawBody,
        signature: "sha256=forged",
        timestamp,
        secret,
        now: 1724544000_000,
      })
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        rawBody,
        signature,
        timestamp,
        secret,
        now: 1724544000_000 + 301_000,
      })
    ).toBe(false);

    const guard = createWebhookReplayGuard(() => 1000);
    expect(guard.accept("provider", "event-1")).toBe(true);
    expect(guard.accept("provider", "event-1")).toBe(false);
    expect(guard.accept("provider", "event-2")).toBe(true);
  });

  it("hashes rate-limit subjects internally, separates scopes, and resets after the policy window", () => {
    let currentTime = 0;
    const limiter = createSecurityRateLimiter(() => currentTime);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        limiter.check("sensitive-account", "user-a", "198.51.100.8")
      ).toEqual({
        ok: true,
      });
    }
    expect(
      limiter.check("sensitive-account", "user-a", "198.51.100.8")
    ).toEqual({
      ok: false,
      retryAfterSeconds: 900,
    });
    expect(
      limiter.check("sensitive-account", "user-b", "198.51.100.8")
    ).toEqual({
      ok: true,
    });
    currentTime = 15 * 60 * 1000;
    expect(
      limiter.check("sensitive-account", "user-a", "198.51.100.8")
    ).toEqual({
      ok: true,
    });
  });
});
