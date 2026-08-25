/** Proofly Phase 15: fail-closed private-file metadata validation and signing preconditions; no storage bucket or public file route is created in this phase. */
import {
  canAccessResource,
  type PermissionActor,
  type ProtectedResource,
} from "./permissions";

export const privateStorageBucket = "proofly-private";
export const maxPrivateFileBytes = 10 * 1024 * 1024;
export const maxPrivateSignedUrlSeconds = 5 * 60;

const allowedContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

export type PrivateFileMetadata = Readonly<{
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  ownerUserId: string;
  scanState: "pending" | "clean" | "rejected";
}>;

export type FileAccessDecision =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: "NOT_FOUND_OR_PRIVATE" | "VALIDATION_FAILED" }>;

function hasSafeObjectKey(objectKey: string, ownerUserId: string) {
  return (
    objectKey.startsWith(`${ownerUserId}/`) &&
    objectKey.length <= 400 &&
    !objectKey.includes("..") &&
    !objectKey.startsWith("/") &&
    !objectKey.includes("\\")
  );
}

/** Validates private upload metadata before a server may issue a signed upload URL. */
export function validatePrivateFileUpload(
  metadata: PrivateFileMetadata
): FileAccessDecision {
  if (
    metadata.bucket !== privateStorageBucket ||
    !hasSafeObjectKey(metadata.objectKey, metadata.ownerUserId) ||
    !allowedContentTypes.has(metadata.contentType) ||
    metadata.sizeBytes <= 0 ||
    metadata.sizeBytes > maxPrivateFileBytes
  ) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  return { ok: true };
}

/** Prevents future server callers from issuing durable private-file links. */
export function validatePrivateSignedUrlExpiry(
  expiresInSeconds: number
): FileAccessDecision {
  return Number.isInteger(expiresInSeconds) &&
    expiresInSeconds > 0 &&
    expiresInSeconds <= maxPrivateSignedUrlSeconds
    ? { ok: true }
    : { ok: false, code: "VALIDATION_FAILED" };
}

/** Requires a clean scan plus the same resource authorization used for the source record before a short-lived signed download URL may be created. */
export function canIssuePrivateFileAccess(
  actor: PermissionActor,
  resource: ProtectedResource,
  metadata: PrivateFileMetadata
): FileAccessDecision {
  if (
    !validatePrivateFileUpload(metadata).ok ||
    metadata.scanState !== "clean" ||
    !canAccessResource(actor, resource)
  ) {
    return { ok: false, code: "NOT_FOUND_OR_PRIVATE" };
  }
  return { ok: true };
}
