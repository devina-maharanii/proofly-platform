import { describe, expect, it } from "vitest";

import {
  projectInputSchema,
  projectReadinessIssues,
  type ProjectInput,
} from "@/lib/project/validation";

const publishableProject: ProjectInput = {
  projectId: "",
  projectType: "hiring_evaluation",
  title: "Bounded onboarding diagnosis",
  oneSentenceGoal:
    "Explain and improve one observable onboarding handoff for a small product team.",
  contextAndProblem:
    "New contributors cannot consistently understand which onboarding information is current, so the team needs a bounded explanation of the handoff and a proposed improvement.",
  whyItMatters:
    "Clear onboarding reduces avoidable handoff confusion for contributors and the team.",
  expectedRole: "Product engineering contributor",
  experienceContext:
    "Use relevant evidence or practice context; personal characteristics are not criteria.",
  requiredSkills: ["typescript", "technical-communication"],
  helpfulSkills: ["documentation"],
  requiredOutput:
    "A concise written diagnosis and a proposed handoff improvement with stated tradeoffs.",
  acceptanceCriteria:
    "The output identifies the user problem, makes assumptions explicit, and proposes a bounded, accessible improvement.",
  submissionFormat:
    "A repository link or document link with a short walkthrough.",
  timeboxHours: 8,
  milestones: [
    {
      name: "Problem framing",
      description: "State the observed handoff boundary.",
    },
  ],
  outOfScope:
    "Production deployment, private credentials, confidential data, and implementation ownership transfer are excluded.",
  rubricSetup: "defined",
  evaluationDimensions: [
    { criterion: "Problem framing and evidence", priority: 50 },
    { criterion: "Bounded, explainable proposal", priority: 50 },
  ],
  reviewMethod:
    "An authorized organization reviewer compares the output to the stated dimensions and provides an explanation.",
  reviewerExpectations:
    "A named organization review process will explain the decision context without using an automated final decision.",
  revisionPolicy:
    "One bounded clarification request may be made when the submitted context is incomplete.",
  decisionTimeline:
    "A decision-context update is expected within ten business days after the deadline.",
  compensationStatus: "unpaid_evaluation",
  workPurpose: "evaluation_exercise",
  ownershipTerms:
    "The participant retains ownership. The organization may not reuse the output in production or request ownership transfer.",
  dataAccessRestrictions:
    "No production data, credentials, private repositories, or uploads are required or provided.",
  participantLimit: 12,
  applicationDeadline: "2099-10-10",
  participantExpectations:
    "Participants should use public or synthetic context only and should not expect a role, contract, or response beyond the stated timeline.",
  expectedResponseTime:
    "An update is expected within ten business days after the stated deadline.",
  noProductionReuse: true,
};

describe("Phase 22 project validation", () => {
  it("accepts a bounded project definition with governed canonical skills and explicit fairness terms", () => {
    const parsed = projectInputSchema.safeParse(publishableProject);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(projectReadinessIssues(parsed.data)).toEqual({});
    }
  });

  it("rejects hidden fields, unknown skill keys, duplicate or overlapping skills", () => {
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        requiredSkills: ["typescript", "not-a-governed-skill"],
      }).success
    ).toBe(false);
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        helpfulSkills: ["typescript"],
      }).success
    ).toBe(false);
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        organizationId: "client-selected-tenant",
      }).success
    ).toBe(false);
  });

  it("blocks protected-characteristic requirements and unpaid production work", () => {
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        expectedRole: "Male developer",
      }).success
    ).toBe(false);
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        workPurpose: "production_need",
        compensationStatus: "unpaid_evaluation",
      }).success
    ).toBe(false);
  });

  it("blocks excessive evaluation timeboxes and requires no production reuse before publishing", () => {
    expect(
      projectInputSchema.safeParse({
        ...publishableProject,
        timeboxHours: 24,
      }).success
    ).toBe(false);
    expect(
      projectReadinessIssues({
        ...publishableProject,
        noProductionReuse: false,
      })
    ).toHaveProperty("noProductionReuse");
  });

  it("requires a future deadline, participant expectations, response timeline, and complete weighted rubric for publication", () => {
    expect(
      projectReadinessIssues({
        ...publishableProject,
        applicationDeadline: "2020-01-01",
        participantExpectations: "",
        expectedResponseTime: "",
        evaluationDimensions: [
          { criterion: "Only one dimension", priority: 80 },
        ],
      })
    ).toMatchObject({
      applicationDeadline: expect.any(String),
      participantExpectations: expect.any(String),
      expectedResponseTime: expect.any(String),
      evaluationDimensions: expect.any(String),
    });
  });

  it("requires a paid context for a future paid trial without simulating a payment flow", () => {
    expect(
      projectReadinessIssues({
        ...publishableProject,
        projectType: "future_paid_trial",
        compensationStatus: "unpaid_evaluation",
      })
    ).toHaveProperty("compensationStatus");
  });
});
