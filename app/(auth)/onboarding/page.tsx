/** Proofly Phase 13: protected, role-aware onboarding; no dashboard, profile publication, marketplace action, payment, or AI workflow. */
import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { CompanyStart } from "@/components/onboarding/company-start";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getOnboardingContext } from "@/lib/onboarding/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding — Proofly",
  robots: { index: false, follow: false },
};

type OnboardingPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const requestedRole =
    typeof params.role === "string" ? params.role : undefined;
  const onboarding = await getOnboardingContext(requestedRole);

  const title =
    requestedRole === "reviewer"
      ? "Prepare a reviewer request."
      : requestedRole === "company_member"
        ? "Set up your organization context."
        : "Make your first action clear.";

  return (
    <AuthShell
      eyebrow="Private onboarding"
      title={title}
      description="A few focused steps keep your first Proofly action understandable. You can save valid progress, skip optional information, and return later."
    >
      {!onboarding ? (
        <section
          className="onboarding-unavailable"
          aria-labelledby="onboarding-context-title"
        >
          <div className="auth-card-header">
            <h2 id="onboarding-context-title">Choose an available context</h2>
            <p>
              Onboarding is available for Talent, Company, and Reviewer
              preparation. Your session and current role context are checked
              server-side.
            </p>
          </div>
          <Link className="button button-primary" href="/auth/continue">
            Return to account contexts
          </Link>
        </section>
      ) : onboarding.target.role === "company_member" &&
        !onboarding.target.organizationId ? (
        <CompanyStart />
      ) : (
        <OnboardingFlow
          role={onboarding.target.role}
          progress={onboarding.progress}
          reviewerRequestStatus={onboarding.reviewerRequestStatus}
        />
      )}
    </AuthShell>
  );
}
