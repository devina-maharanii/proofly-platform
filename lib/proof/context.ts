/**
 * Phase 20 public Proof reader. This server-only reader intentionally exposes
 * only active, source-linked, publicly eligible verification context.
 */
import "server-only";

import { isValidPublicHandle } from "@/lib/profile/handle";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PublicTalentProof = Readonly<{
  id: string;
  skillKey: string;
  verificationMethod: string;
  reviewStatus: "verified";
  verifiedAt: string;
  reviewerAttribution: string;
  evidencePublicId: string;
  evidenceTitle: string;
}>;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function getPublicTalentProofs(
  handle: string
): Promise<PublicTalentProof[]> {
  if (!isValidPublicHandle(handle)) return [];
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_talent_proofs", {
    requested_handle: handle,
  });
  if (error || !Array.isArray(data)) return [];

  return data.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const proof = item as Record<string, unknown>;
    const id = stringValue(proof.id);
    const skillKey = stringValue(proof.skill_key);
    const verificationMethod = stringValue(proof.verification_method);
    const verifiedAt = stringValue(proof.verified_at);
    const evidencePublicId = stringValue(proof.evidence_public_id);
    if (
      !id ||
      !skillKey ||
      !verificationMethod ||
      !verifiedAt ||
      !/^[0-9a-f-]{36}$/i.test(evidencePublicId) ||
      proof.review_status !== "verified"
    ) {
      return [];
    }
    return [
      {
        id,
        skillKey,
        verificationMethod,
        reviewStatus: "verified" as const,
        verifiedAt,
        reviewerAttribution: stringValue(proof.reviewer_attribution),
        evidencePublicId,
        evidenceTitle: stringValue(proof.evidence_title),
      },
    ];
  });
}
