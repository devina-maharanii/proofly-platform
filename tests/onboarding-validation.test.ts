import { describe, expect, it } from "vitest";

import {
  emptyOnboardingDraft,
  type OnboardingDraft,
} from "@/lib/onboarding/types";
import {
  getResumeStepIndex,
  normalizeStoredDraft,
  parseOnboardingDraft,
  serializeOnboardingDraft,
  validateOnboardingStep,
} from "@/lib/onboarding/validation";

function draft(values: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    ...emptyOnboardingDraft,
    fullName: "Avery Khan",
    displayName: "Avery",
    primaryPurpose: "build_proof",
    timezone: "Asia/Dhaka",
    ...values,
  };
}

describe("Phase 13 private onboarding validation", () => {
  it("requires the common private identity and preference fields before moving forward", () => {
    const errors = validateOnboardingStep(
      draft({ fullName: "", displayName: "", timezone: "" }),
      "talent",
      "review"
    );

    expect(errors).toMatchObject({
      fullName: expect.any(String),
      displayName: expect.any(String),
      timezone: expect.any(String),
    });
  });

  it("validates purpose before transition and resumes a private draft at its first incomplete step", () => {
    expect(
      validateOnboardingStep(
        draft({ primaryPurpose: "", timezone: "" }),
        "talent",
        "purpose"
      )
    ).toMatchObject({
      primaryPurpose: expect.any(String),
      timezone: expect.any(String),
    });
    expect(getResumeStepIndex("talent", draft(), true)).toBe(3);
    expect(getResumeStepIndex("talent", draft({ displayName: "" }), true)).toBe(
      0
    );
    expect(
      getResumeStepIndex(
        "reviewer",
        draft({
          primaryPurpose: "prepare_reviewer_request",
          expertiseAreas: ["frontend"],
          experienceEvidence: "A concise private explanation.",
        }),
        true
      )
    ).toBe(4);
  });

  it("keeps optional talent portfolio data skippable while enforcing the approved first-action inputs", () => {
    const validTalent = draft({
      developerFocus: "frontend",
      experienceLevel: "early_career",
      goals: ["prove_skills"],
      availability: "part_time",
      portfolioUrl: "",
    });

    expect(validateOnboardingStep(validTalent, "talent", "review")).toEqual({});
    expect(
      validateOnboardingStep({ ...validTalent, goals: [] }, "talent", "role")
    ).toHaveProperty("goals");
  });

  it("requires company scope inputs but does not create a project, billing input, or marketplace outcome", () => {
    const company = draft({
      primaryPurpose: "prepare_team",
      companySize: "1_10",
      hiringStage: "planning",
      hiringFocus: "backend",
      companyMemberRole: "hiring_member",
      companyFirstAction: "create_project",
    });

    expect(validateOnboardingStep(company, "company_member", "review")).toEqual(
      {}
    );
    expect(
      validateOnboardingStep(
        { ...company, companyFirstAction: "" },
        "company_member",
        "role"
      )
    ).toHaveProperty("companyFirstAction");
  });

  it("collects a reviewer request as private preparation and never treats it as reviewer approval", () => {
    const reviewer = draft({
      primaryPurpose: "prepare_reviewer_request",
      expertiseAreas: ["frontend"],
      experienceEvidence:
        "I have reviewed frontend work with structured criteria.",
    });

    expect(validateOnboardingStep(reviewer, "reviewer", "review")).toEqual({});
    expect(
      validateOnboardingStep(
        { ...reviewer, expertiseAreas: [] },
        "reviewer",
        "role"
      )
    ).toHaveProperty("expertiseAreas");
  });

  it("rejects unknown draft keys and discards malformed stored drafts rather than using them", () => {
    expect(
      parseOnboardingDraft({ ...draft(), unapprovedRole: "administrator" })
        .success
    ).toBe(false);
    expect(normalizeStoredDraft({ unapprovedRole: "administrator" })).toEqual(
      emptyOnboardingDraft
    );
  });

  it("round-trips only the database-whitelisted snake_case draft keys without accepting client authority fields", () => {
    const stored = serializeOnboardingDraft(
      draft({ developerFocus: "frontend", goals: ["prove_skills"] })
    );

    expect(stored).toMatchObject({
      full_name: "Avery Khan",
      developer_focus: "frontend",
      goals: ["prove_skills"],
    });
    expect(stored).not.toHaveProperty("user_id");
    expect(stored).not.toHaveProperty("role");
    expect(normalizeStoredDraft(stored)).toMatchObject({
      fullName: "Avery Khan",
      developerFocus: "frontend",
    });
  });
});
