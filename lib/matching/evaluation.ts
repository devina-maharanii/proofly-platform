/** Evidence Ledger Editorial — Phase 32 publishes metric definitions and synthetic QA expectations, never outcome claims. */

export const matchingEvaluationMetrics = [
  {
    key: "relevance_feedback_rate",
    label: "Voluntary relevance feedback",
    boundary:
      "Missing feedback is unknown; it is not counted as satisfaction or dissatisfaction.",
  },
  {
    key: "explanation_coverage",
    label: "Explanation coverage",
    boundary:
      "Checks for source-linked reasons and limitations, not hiring quality.",
  },
  {
    key: "false_positive_signal_rate",
    label: "Reported factual issues",
    boundary:
      "Reports are quality and safety signals, never reputation penalties.",
  },
  {
    key: "fairness_review_coverage",
    label: "Rule exclusion review",
    boundary:
      "No protected attributes or proxy cohorts are persisted for matching.",
  },
  {
    key: "downstream_human_action_count",
    label: "Human review actions",
    boundary:
      "A recorded review action is not a hiring, performance, or outcome claim.",
  },
] as const;

export const matchingEvaluationDatasetScope = {
  kind: "synthetic_contract_cases",
  purpose:
    "Test deterministic provenance, consent withdrawal, missing data, revoked proof, and protected-input rejection without production-person data.",
  prohibitedData: [
    "private messages",
    "protected attributes",
    "identity assurance",
    "popularity",
    "private evidence",
  ],
} as const;
