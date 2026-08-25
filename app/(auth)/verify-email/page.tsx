/** Proofly Phase 11 verification route: actionable confirmation and resend path without account disclosure. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { resendVerificationAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Verify your email — Proofly",
  description:
    "Confirm your Proofly account email or request another confirmation message.",
  robots: { index: false, follow: false },
};

type VerifyEmailPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const sent = params.status === "sent";
  const verified = params.status === "verified";

  return (
    <AuthShell
      eyebrow="Email confirmation"
      title="Confirm the address you control."
      description="Email confirmation establishes account control. It does not verify skill, employment, identity assurance, or any product role."
    >
      <div className="auth-card-header">
        <h2>Check your email</h2>
        <p>
          Open the confirmation message and return here after the secure link
          completes.
        </p>
      </div>
      {verified ? (
        <p
          className="auth-status"
          data-status="success"
          role="status"
          aria-live="polite"
        >
          Your email has been confirmed. You can now sign in.
        </p>
      ) : sent ? (
        <p
          className="auth-status"
          data-status="success"
          role="status"
          aria-live="polite"
        >
          If an account was created with that address, a confirmation message is
          on its way.
        </p>
      ) : null}
      <AuthForm
        action={resendVerificationAction}
        submitLabel="Send another confirmation message"
        emailHint="Use the address used to create the account."
      />
      <div className="auth-links">
        <Link href={"/sign-in" as Route}>Return to sign in</Link>
        <Link href={"/forgot-password" as Route}>Recover account access</Link>
      </div>
    </AuthShell>
  );
}
