/** Evidence Ledger Editorial — Phase 30 uses source-linked Proof context, never scores or ranks people. */
import type { CanonicalSkillKey } from "@/lib/profile/types";

export const proofReputationEventTypes = [
  "proof.verified",
  "proof.published",
  "proof.revoked",
  "company_outcome.proposed",
  "company_outcome.confirmed",
  "company_outcome.withdrawn",
  "endorsement.proposed",
  "endorsement.confirmed",
  "endorsement.withdrawn",
  "reputation.correction",
] as const;

export type ProofReputationEventType =
  (typeof proofReputationEventTypes)[number];
export type ProofRelationshipState = "proposed" | "consented" | "withdrawn";

export type PublicProofGraph = {
  summary: {
    activeVerifiedProofCount: number;
    verifiedSkillCount: number;
    consentedCompanyOutcomeCount: number;
    latestVerifiedAt: string | null;
  };
  timeline: Array<{
    proofId: string;
    skillKey: CanonicalSkillKey;
    verificationMethod: string;
    verifiedAt: string | null;
    evidencePublicId: string;
    evidenceTitle: string;
    projectPublicId: string | null;
    projectTitle: string;
    reviewerAttribution: string;
    verificationState: "human_verified";
  }>;
  skills: Array<{
    skillKey: CanonicalSkillKey;
    proofCount: number;
    latestVerifiedAt: string | null;
    evidence: Array<{
      proofId: string;
      evidencePublicId: string;
      evidenceTitle: string;
      verifiedAt: string | null;
    }>;
  }>;
  companyOutcomes: Array<{
    id: string;
    proofId: string;
    outcomeType: string;
    contextSummary: string;
    consentedAt: string | null;
  }>;
  endorsements: Array<{
    id: string;
    proofId: string;
    skillKey: CanonicalSkillKey;
    endorsementText: string;
    consentedAt: string | null;
  }>;
};

export type TalentProofGraphAudit = {
  events: Array<{
    id: string;
    eventType: ProofReputationEventType;
    visibility: "private" | "public" | "restricted";
    eventSummary: string;
    sourceEventType: string;
    sourceEventId: string;
    publicProofId: string | null;
    occurredAt: string | null;
  }>;
  outcomes: Array<{
    id: string;
    publicProofId: string;
    outcomeType: string;
    contextSummary: string;
    state: ProofRelationshipState;
    proposedAt: string | null;
    consentedAt: string | null;
    withdrawnAt: string | null;
  }>;
  endorsements: Array<{
    id: string;
    publicProofId: string;
    skillKey: CanonicalSkillKey;
    endorsementText: string;
    state: ProofRelationshipState;
    proposedAt: string | null;
    consentedAt: string | null;
    withdrawnAt: string | null;
  }>;
};

export const emptyPublicProofGraph = (): PublicProofGraph => ({
  summary: {
    activeVerifiedProofCount: 0,
    verifiedSkillCount: 0,
    consentedCompanyOutcomeCount: 0,
    latestVerifiedAt: null,
  },
  timeline: [],
  skills: [],
  companyOutcomes: [],
  endorsements: [],
});

export const emptyTalentProofGraphAudit = (): TalentProofGraphAudit => ({
  events: [],
  outcomes: [],
  endorsements: [],
});

export type ProofGraphActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialProofGraphActionState: ProofGraphActionState = {
  status: "idle",
  message: "",
};

export const proofRelationshipStateLabel: Record<
  ProofRelationshipState,
  string
> = {
  proposed: "Awaiting your consent",
  consented: "Public with your consent",
  withdrawn: "Consent withdrawn",
};
