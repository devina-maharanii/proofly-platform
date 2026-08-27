/** Design: Evidence Ledger Editorial — reusable, project-context templates make human criteria inspectable while remaining editable and never generating a score. */
import type {
  RubricDescriptor,
  RubricDimensionInput,
  RubricInput,
} from "./types";

export type RubricTemplate = Readonly<{
  key: string;
  label: string;
  description: string;
  build: (projectTitle: string) => RubricInput;
}>;

const descriptorSet = (focus: string): readonly RubricDescriptor[] => [
  {
    level: "not_demonstrated",
    description: `The submitted work does not provide observable evidence for ${focus} in this project.`,
  },
  {
    level: "emerging",
    description: `The work begins to address ${focus}, but important project-specific evidence or reasoning is incomplete.`,
  },
  {
    level: "working_in_context",
    description: `The work addresses ${focus} for the stated project scope, with evidence that can be discussed in feedback.`,
  },
  {
    level: "independent_in_context",
    description: `The work addresses ${focus} independently, with coherent reasoning and clear trade-offs for this project.`,
  },
  {
    level: "advanced_in_context",
    description: `The work demonstrates thoughtful ${focus} beyond the immediate path while staying proportionate to this project scope.`,
  },
];

function dimension(
  name: string,
  skillKeys: readonly RubricDimensionInput["skillKeys"][number][],
  weight: number,
  priority: RubricDimensionInput["priority"]
): RubricDimensionInput {
  return {
    name,
    description: `Assess observable ${name.toLocaleLowerCase()} in the submitted work against the stated project constraints.`,
    skillKeys,
    weight,
    priority,
    observableCriteria: [
      `The submission shows a concrete, project-relevant approach to ${name.toLocaleLowerCase()}.`,
    ],
    evidenceExamples: [
      "A concise explanation, implementation detail, or test that supports the stated approach.",
    ],
    commonFailureModes: [
      "The submitted work makes a claim without enough project-relevant evidence to evaluate it.",
    ],
    reviewerGuidance:
      "Assess the stated project evidence and trade-offs. Do not infer ability, seniority, identity, or overall potential beyond this bounded submission.",
    feedbackVisibility: "talent_and_company",
    descriptors: descriptorSet(name.toLocaleLowerCase()),
  };
}

function template(
  key: string,
  title: string,
  projectTitle: string,
  dimensions: readonly RubricDimensionInput[]
): RubricInput {
  return {
    title: `${projectTitle || "Project"} — ${title}`.slice(0, 120),
    projectContext:
      "Use this rubric only for the defined project scope, requirements, acceptance criteria, and submitted evidence. It does not create a universal skill, employment, or reputation score.",
    templateKey: key,
    dimensions,
    calibrationExamples: [],
  };
}

export const rubricTemplates: readonly RubricTemplate[] = [
  {
    key: "frontend-delivery",
    label: "Frontend delivery",
    description:
      "Interface behavior, responsive implementation, and accessible evidence for a bounded product surface.",
    build: projectTitle =>
      template("frontend-delivery", "Frontend delivery rubric", projectTitle, [
        dimension(
          "Interface implementation",
          ["react", "component-design"],
          40,
          "essential"
        ),
        dimension(
          "Responsive and accessible behavior",
          ["responsive-layout", "web-accessibility"],
          35,
          "essential"
        ),
        dimension(
          "Testing and delivery reasoning",
          ["testing", "technical-communication"],
          25,
          "important"
        ),
      ]),
  },
  {
    key: "backend-service",
    label: "Backend service",
    description:
      "API behavior, secure data handling, and explicit validation for a bounded service or integration.",
    build: projectTitle =>
      template("backend-service", "Backend service rubric", projectTitle, [
        dimension(
          "API and domain behavior",
          ["nodejs", "api-design"],
          40,
          "essential"
        ),
        dimension(
          "Validation and authorization",
          ["data-validation", "authorization"],
          35,
          "essential"
        ),
        dimension(
          "Data and operational reasoning",
          ["data-modeling", "observability"],
          25,
          "important"
        ),
      ]),
  },
  {
    key: "full-stack-product",
    label: "Full-stack product slice",
    description:
      "A product-focused implementation that connects interface, service, and evidence of deliberate trade-offs.",
    build: projectTitle =>
      template(
        "full-stack-product",
        "Full-stack product rubric",
        projectTitle,
        [
          dimension(
            "Product implementation",
            ["react", "nodejs"],
            40,
            "essential"
          ),
          dimension(
            "Secure user and data flows",
            ["authentication", "authorization"],
            35,
            "essential"
          ),
          dimension(
            "Decision communication",
            ["requirements-interpretation", "technical-communication"],
            25,
            "important"
          ),
        ]
      ),
  },
  {
    key: "custom-project-context",
    label: "Custom project context",
    description:
      "A neutral starting point for a specific bounded project. Edit every dimension before it is marked ready.",
    build: projectTitle =>
      template("custom-project-context", "Contextual rubric", projectTitle, [
        dimension(
          "Project-relevant implementation",
          ["technical-communication"],
          100,
          "essential"
        ),
      ]),
  },
];

export function rubricTemplateFor(
  key: string,
  projectTitle: string
): RubricInput {
  return (
    rubricTemplates.find(template => template.key === key) ?? rubricTemplates[3]
  ).build(projectTitle);
}
