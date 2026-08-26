import { describe, expect, it } from "vitest";

import {
  activeDiscoveryFilterCount,
  parseProjectDiscoverySearchParams,
  projectDiscoveryQueryString,
} from "@/lib/project/discovery";

describe("Phase 23 project discovery URL contract", () => {
  it("accepts only bounded governed filters and preserves stable deterministic URL state", () => {
    const filters = parseProjectDiscoverySearchParams({
      q: "  React accessibility  ",
      skill: "react",
      family: "frontend",
      level: "independent",
      type: "public_challenge",
      timebox: "up_to_20",
      compensation: "paid_defined",
      mode: "remote",
      timezone: "UTC",
      deadline: "next_30_days",
      company: "1-10",
      sort: "newest",
      saved: "1",
    });
    expect(filters).toMatchObject({
      query: "React accessibility",
      skill: "react",
      skillFamily: "frontend",
      projectType: "public_challenge",
      savedOnly: true,
    });
    expect(projectDiscoveryQueryString(filters)).toBe(
      "/projects?q=React+accessibility&skill=react&family=frontend&level=independent&type=public_challenge&timebox=up_to_20&compensation=paid_defined&mode=remote&timezone=UTC&deadline=next_30_days&company=1-10&sort=newest&saved=1"
    );
    expect(activeDiscoveryFilterCount(filters)).toBe(12);
  });

  it("drops private project types, unknown skills, malformed cursors, and unsupported filter values", () => {
    const filters = parseProjectDiscoverySearchParams({
      skill: "unapproved-skill",
      family: "invented-family",
      type: "private_invite_only",
      timebox: "a-lifetime",
      compensation: "payment-flow",
      mode: "somewhere",
      deadline: "whenever",
      sort: "popularity",
      cursor: "not a cursor",
    });
    expect(filters).toMatchObject({
      skill: "",
      skillFamily: "",
      projectType: "",
      timebox: "",
      compensation: "",
      workMode: "any",
      deadline: "any",
      sort: "relevance",
      cursor: "",
    });
  });
});
