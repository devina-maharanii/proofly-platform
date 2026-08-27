/** Evidence Ledger Editorial — Phase 32 exposes a server-only, disabled-by-default assistive AI boundary; no model call makes a hiring or proof decision. */
import "server-only";

export type MatchingAiRequirementDraft = Readonly<{
  requiredSkills: string[];
  helpfulSkills: string[];
  evidenceExpectations: Record<
    string,
    "human_verified_public_proof" | "context_only"
  >;
  uncertainty: string[];
  sourceReferences: string[];
  modelReference: string;
  promptVersion: string;
}>;

export type MatchingAiAdapter = Readonly<{
  id: string;
  enabled: boolean;
  extractProjectRequirementDraft: (
    source: Readonly<{ projectId: string; projectVersion: number }>
  ) => Promise<MatchingAiRequirementDraft | null>;
}>;

export const disabledMatchingAiAdapter: MatchingAiAdapter = {
  id: "matching-ai-disabled",
  enabled: false,
  async extractProjectRequirementDraft() {
    return null;
  },
};

export function getMatchingAiAdapter(): MatchingAiAdapter {
  // A concrete provider requires its own approved model registry, evaluation artifact, secret, and enablement review.
  return disabledMatchingAiAdapter;
}
