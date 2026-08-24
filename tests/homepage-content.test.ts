import { describe, expect, it } from "vitest";

import {
  homepageCopy,
  primaryNavItems,
} from "../components/marketing/marketing-content";

describe("homepage content contract", () => {
  it("keeps the approved evidence-first hero direction", () => {
    expect(homepageCopy.hero.headline).toBe("Build work people can trust.");
    expect(homepageCopy.hero.description).toContain("real software work");
    expect(homepageCopy.hero.description).toContain("reviewable");
  });

  it("keeps the proof loop ordered and bounded", () => {
    expect(homepageCopy.proofSteps).toHaveLength(5);
    expect(homepageCopy.proofSteps[0]?.title).toBe("Choose relevant work");
    expect(homepageCopy.proofSteps.at(-1)?.title).toBe("Move toward paid work");
  });

  it("keeps public navigation constrained to implemented homepage destinations", () => {
    expect(primaryNavItems).toHaveLength(4);
    expect(primaryNavItems.every(item => item.href.startsWith("#"))).toBe(true);
  });
});
