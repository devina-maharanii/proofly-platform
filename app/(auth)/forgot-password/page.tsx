/** Proofly Phase 11 recovery route: non-enumerating reset request with clear next actions. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Reset your password — Proofly",
  description:
    "Request a secure Proofly password reset without exposing account existence.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Recover access without revealing account details."
      description="Enter an email address and we will provide instructions only if it is eligible for password recovery."
    >
      <div className="auth-card-header">
        <h2>Request a reset message</h2>
        <p>
          For privacy, the response is the same whether or not the email has an
          account.
        </p>
      </div>
      <AuthForm
        action={requestPasswordResetAction}
        submitLabel="Send reset instructions"
        emailHint="Use the email address associated with your account."
      />
      <div className="auth-links">
        <Link href={"/sign-in" as Route}>Return to sign in</Link>
        <Link href={"/verify-email" as Route}>Need to confirm your email?</Link>
      </div>
    </AuthShell>
  );
}
