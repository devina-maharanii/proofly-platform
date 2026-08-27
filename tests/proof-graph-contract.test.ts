import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270039_phase30_proof_graph.sql"
  ),
  "utf8"
);
const integrityMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270040_phase30_graph_integrity.sql"
  ),
  "utf8"
);
const relationshipMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202608270041_phase30_graph_relationships.sql"
  ),
  "utf8"
);
const graphContext = readFileSync(
  resolve(process.cwd(), "lib/proof-graph/context.ts"),
  "utf8"
);
const graphActions = readFileSync(
  resolve(process.cwd(), "lib/proof-graph/actions.ts"),
  "utf8"
);
const publicGraph = readFileSync(
  resolve(process.cwd(), "components/proof-graph/public-proof-graph.tsx"),
  "utf8"
);
const privateAudit = readFileSync(
  resolve(
    process.cwd(),
    "components/proof-graph/private-proof-graph-audit.tsx"
  ),
  "utf8"
);
const publicProfile = readFileSync(
  resolve(process.cwd(), "components/profile/public-talent-profile.tsx"),
  "utf8"
);
const publicPage = readFileSync(
  resolve(process.cwd(), "app/talent/[handle]/page.tsx"),
  "utf8"
);
const privatePage = readFileSync(
  resolve(process.cwd(), "app/(auth)/proof/page.tsx"),
  "utf8"
);
const proxy = readFileSync(resolve(process.cwd(), "proxy.ts"), "utf8");

describe("Phase 30 explainable Proof Graph contract", () => {
  it("models every required graph node and source-bound relationship without a universal reputation score", () => {
    for (const node of [
      "talent_user_id",
      "skill_key",
      "evidence_id",
      "submission_version_id",
      "project_id",
      "review_id",
      "verification_proof_id",
      "proof_company_outcomes",
      "proof_endorsements",
      "proof_reputation_events",
    ]) {
      expect(migration).toContain(node);
    }
    for (const relationship of [
      "person_demonstrated_skill",
      "submission_belongs_to_project",
      "review_evaluates_submission",
      "proof_verifies_skill",
      "person_contributed_to_team_project",
      "company_outcome_context",
      "endorsement_context",
      "reputation_event_changes_contextual_signal",
    ]) {
      expect(`${migration}\n${integrityMigration}`).toContain(relationship);
    }
    expect(`${migration}\n${publicGraph}`).not.toMatch(
      /leaderboard|universal (talent )?score|gamified points/i
    );
  });

  it("makes each public graph item prove its active human-verification, exact decision, evidence, and consent chain", () => {
    for (const requirement of [
      "proof.status = 'verified'",
      "proof.revoked_at is null",
      "verification.state = 'verified'",
      "verification.current_submission_version_id = proof.submission_version_id",
      "verification.rubric_version_id = proof.rubric_version_id",
      "verification_proof.state = 'public'",
      "evidence.state = 'published'",
      "outcome.state = 'consented'",
      "endorsement.state = 'consented'",
    ]) {
      expect(migration).toContain(requirement);
    }
    expect(graphContext).toContain("get_public_talent_proof_graph");
    expect(publicPage).toContain("getPublicTalentProofGraph");
    expect(publicProfile).toContain("PublicProofGraphView");
  });

  it("cannot manufacture verified Proof from self-claims or client data", () => {
    expect(migration).toContain("private.assert_public_proof_chain");
    expect(migration).toContain("source_verification_event_id");
    expect(migration).toContain("review.state = 'verified'");
    expect(migration).toContain("private.require_active_proof_graph_talent");
    expect(graphActions).not.toContain("publish_verified_proof");
    expect(graphActions).not.toMatch(/verified.*=.*true/i);
  });

  it("keeps reputation events append-only and gives corrections a new auditable record", () => {
    expect(integrityMigration).toContain(
      "reject_proof_reputation_event_mutation"
    );
    expect(integrityMigration).toContain("before update or delete");
    expect(integrityMigration).toContain("APPEND_ONLY_EVENT_LEDGER");
    expect(integrityMigration).toContain("append_proof_reputation_correction");
    expect(integrityMigration).toContain("corrected_event_id");
    expect(integrityMigration).toContain("reputation.correction");
    expect(privateAudit).toContain("Append-only record");
    expect(privateAudit).toContain("source:");
  });

  it("requires Talent consent before public company outcomes or endorsements and records withdrawal as a new event", () => {
    expect(migration).toContain(
      "state public.proof_relationship_state not null default 'proposed'"
    );
    expect(migration).toContain("consent_company_proof_outcome");
    expect(migration).toContain("withdraw_company_proof_outcome_consent");
    expect(migration).toContain("consent_proof_endorsement");
    expect(migration).toContain("withdraw_proof_endorsement");
    expect(migration).toContain("company_outcome.withdrawn");
    expect(migration).toContain("endorsement.withdrawn");
    expect(relationshipMigration).toContain(
      "require_consented_outcome_for_endorsement"
    );
    expect(graphActions).toContain("randomUUID()");
    expect(privateAudit).toContain("Make public with my consent");
    expect(privateAudit).toContain("Withdraw public consent");
  });

  it("keeps reviewer-private notes, revoked reasons, and private graph edges out of the public projection", () => {
    const publicReader = migration.slice(
      migration.indexOf("get_public_talent_proof_graph"),
      migration.indexOf("get_private_talent_proof_graph_audit")
    );
    expect(publicReader).not.toMatch(
      /private_note|reviewer_private|revocation_reason/i
    );
    expect(publicReader).toContain("proof.revoked_at is null");
    expect(publicReader).toContain("profile.state = 'published'");
    expect(migration).toContain("private.require_proof_graph_company_owner");
    expect(migration).toContain(
      "revoke all on table public.proof_graph_relations"
    );
  });

  it("renders public context as readable evidence provenance and reserves the detailed event ledger for the Talent", () => {
    expect(publicGraph).toContain("How active Proof connects");
    expect(publicGraph).toContain("Skill to evidence");
    expect(publicGraph).toContain(
      "not a score, ranking, or hiring recommendation"
    );
    expect(publicGraph).toMatch(
      /Private, expired, revoked,[\s\S]*unconsented records are not shown/
    );
    expect(privateAudit).toContain("Your Proof, with its source trail.");
    expect(privateAudit).toContain("Private Proof record");
    expect(privatePage).toContain("robots: { index: false, follow: false }");
    expect(proxy).toContain('"/proof"');
  });

  it("contains no company-search ranking, AI decision, or leaderboard surface", () => {
    const phaseSource = `${migration}\n${integrityMigration}\n${relationshipMigration}\n${graphContext}\n${graphActions}\n${publicGraph}\n${privateAudit}`;
    expect(phaseSource).not.toMatch(
      /ai ranking|automated decision|company search ranking/i
    );
    expect(phaseSource).not.toMatch(/leaderboard|popularity score|gamif/i);
  });
});
