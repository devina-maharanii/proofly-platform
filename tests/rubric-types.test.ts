import { describe, expect, it } from "vitest";

import {
  canTransitionRubric,
  isImmutableRubricVersion,
} from "@/lib/rubric/types";

describe("Phase 28 rubric state contract", () => {
  it("allows only controlled draft, review-ready, publication, lock, and archival transitions", () => {
    expect(canTransitionRubric("draft", "ready_for_review")).toBe(true);
    expect(canTransitionRubric("ready_for_review", "published")).toBe(true);
    expect(canTransitionRubric("published", "locked")).toBe(true);
    expect(canTransitionRubric("locked", "archived")).toBe(true);
    expect(canTransitionRubric("published", "draft")).toBe(false);
    expect(canTransitionRubric("archived", "draft")).toBe(false);
  });

  it("treats published, locked, and archived versions as immutable historical records", () => {
    expect(isImmutableRubricVersion("draft")).toBe(false);
    expect(isImmutableRubricVersion("published")).toBe(true);
    expect(isImmutableRubricVersion("locked")).toBe(true);
    expect(isImmutableRubricVersion("archived")).toBe(true);
  });
});
