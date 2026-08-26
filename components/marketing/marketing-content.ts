export const homepageCopy = {
  hero: {
    headline: "Build work people can trust.",
    description:
      "Proofly makes real software work visible, reviewable, and understandable—so early-career talent and startups can move toward a fairer next opportunity.",
  },
  proofSteps: [
    {
      number: "01",
      title: "Choose relevant work",
      description:
        "Start with a bounded software challenge that has real context and clear expectations.",
    },
    {
      number: "02",
      title: "Submit the work behind the claim",
      description:
        "Attach a working version, explanation, and the evidence needed to understand the decisions.",
    },
    {
      number: "03",
      title: "Receive qualified human review",
      description:
        "A reviewer uses a transparent rubric, declares conflicts, and leaves actionable feedback.",
    },
    {
      number: "04",
      title: "Publish explainable proof",
      description:
        "When the review chain is valid, talent chooses what eligible proof becomes public.",
    },
    {
      number: "05",
      title: "Move toward paid work",
      description:
        "Companies inspect relevant context, then make their own human decision about a fair paid trial.",
    },
  ],
  reviewContext: {
    skill: "API integration",
    project: "Orders API — submission v2",
    feedback:
      "Explain the retry boundary, then the review can be finalized against the current rubric.",
  },
} as const;

export const primaryNavItems = [
  { href: "/projects", label: "Explore projects" },
  { href: "#talent", label: "For talent" },
  { href: "#companies", label: "For companies" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#verification", label: "Verification" },
] as const;
