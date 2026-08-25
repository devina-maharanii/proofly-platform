/** Proofly Phase 11 registration route: role-neutral account creation with email verification. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUpAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Create an account — Proofly",
  description:
    "Create a Proofly account and verify your email to control your session.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create an account"
      title="Account first. Context follows."
      description="Create a role-neutral account first. You will verify your email before using an authenticated Proofly surface."
    >
      <div className="auth-card-header">
        <h2>Create your account</h2>
        <p>
          Use an email address you can access. We will send a confirmation
          message next.
        </p>
      </div>
      <AuthForm
        action={signUpAction}
        submitLabel="Create account"
        showPassword
        showPasswordConfirmation
      />
      <p className="auth-footnote">
        Already have an account?{" "}
        <Link href={"/sign-in" as Route}>Sign in instead</Link>.
      </p>
    </AuthShell>
  );
}
