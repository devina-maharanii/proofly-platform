/** Proofly Phase 11 entry route: explain role intentions without storing or authorizing a role. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Get started with Proofly",
  description:
    "Choose a role context before creating a role-neutral Proofly account.",
  robots: { index: false, follow: false },
};

const roleChoices = [
  {
    value: "talent",
    label: "Build your proof",
    description:
      "Start with the expectation that real work can become reviewable evidence; it does not guarantee an opportunity.",
  },
  {
    value: "company",
    label: "Hire from evidence",
    description:
      "Start with the expectation that you will inspect context before making your own human decision.",
  },
  {
    value: "reviewer",
    label: "Become a reviewer",
    description:
      "Start with the expectation that review requires qualified, accountable human judgment and later policy approval.",
  },
] as const;

export default function GetStartedPage() {
  return (
    <AuthShell
      eyebrow="Account entry"
      title="Choose the context. Create one account."
      description="This selection only clarifies what you want to explore. It does not create a role, authorize access, publish a profile, or start a marketplace action."
    >
      <div className="auth-card-header">
        <h2>What brings you to Proofly?</h2>
        <p>Start by creating and confirming a role-neutral account.</p>
      </div>
      <div className="auth-choice-list">
        {roleChoices.map((choice, index) => (
          <article className="auth-choice" key={choice.value}>
            <span className="auth-choice-number">0{index + 1}</span>
            <div>
              <h3>{choice.label}</h3>
              <p>{choice.description}</p>
            </div>
            <Link
              className="button button-secondary"
              href={`/sign-up?intent=${choice.value}` as Route}
            >
              {choice.value === "talent"
                ? "Build proof account"
                : choice.value === "company"
                  ? "Inspect evidence account"
                  : "Request reviewer context"}
            </Link>
          </article>
        ))}
      </div>
      <p className="auth-footnote">
        Already have an account? <Link href={"/sign-in" as Route}>Sign in</Link>
        .
      </p>
    </AuthShell>
  );
}
