import { describe, expect, it } from "vitest";

import {
  isReservedCompanyHandle,
  isValidCompanyHandle,
} from "@/lib/company/handle";
import { companyProfileInputSchema } from "@/lib/company/validation";

const validCompanyProfile = {
  logoUrl: "https://example.com/logo.png",
  shortDescription: "A small company building dependable developer tools.",
  websiteUrl: "https://example.com",
  industry: "Developer tools",
  companySize: "Small product team",
  foundedYear: "2024",
  whatWeBuild:
    "We build tools that make software delivery more understandable.",
  engineeringPractices: ["Code review"],
  technologyAreas: ["TypeScript"],
  collaborationStyle: "Written decisions",
  timezoneOverlap: "UTC overlap",
  workLocationPreference: "Remote-first",
  typicalProjectTypes: ["Product UI"],
  hiringFocus: "Early-career product engineering",
  engagementTypes: ["Contract"],
  reviewTrialPhilosophy:
    "Use clear criteria and do not request unpaid production work.",
  activeOpportunities: false,
  responseExpectations: "No response promise is made here.",
  memberRoleLabel: "Engineering lead",
  showMyAttribution: false,
};

describe("Phase 21 company profile validation", () => {
  it("accepts bounded, explicit company-context fields", () => {
    expect(
      companyProfileInputSchema.safeParse(validCompanyProfile).success
    ).toBe(true);
  });

  it("requires secure website and logo URLs when supplied", () => {
    expect(
      companyProfileInputSchema.safeParse({
        ...validCompanyProfile,
        websiteUrl: "http://example.com",
      }).success
    ).toBe(false);
    expect(
      companyProfileInputSchema.safeParse({
        ...validCompanyProfile,
        logoUrl: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("rejects invalid public company route handles and protected namespaces", () => {
    expect(isValidCompanyHandle("proofly-labs")).toBe(true);
    expect(isValidCompanyHandle("A Company")).toBe(false);
    expect(isReservedCompanyHandle("settings")).toBe(true);
    expect(isReservedCompanyHandle("companies")).toBe(true);
  });

  it("does not accept unbounded arrays or hidden client-supplied fields", () => {
    expect(
      companyProfileInputSchema.safeParse({
        ...validCompanyProfile,
        technologyAreas: Array.from(
          { length: 9 },
          (_, index) => `Area ${index}`
        ),
      }).success
    ).toBe(false);
    expect(
      companyProfileInputSchema.safeParse({
        ...validCompanyProfile,
        privateContact: "not allowed",
      }).success
    ).toBe(false);
  });
});
