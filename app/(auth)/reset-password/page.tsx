/** Proofly Phase 11 reset route: session-protected password update with expired-link recovery. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { resetPasswordAction } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Choose a new password — Proofly",
  description:
    "Choose a new password for your verified Proofly recovery session.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password recovery"
      title="Set a new password from a verified session."
      description="If this recovery session has expired, request a new reset message instead of reusing an old link."
    >
      <div className="auth-card-header">
        <h2>Choose a new password</h2>
        <p>
          Use 12 to 128 characters. Your previous password is never shown here.
        </p>
      </div>
      <AuthForm
        action={resetPasswordAction}
        submitLabel="Update password"
        showEmail={false}
        showPassword
        showPasswordConfirmation
      />
      <div className="auth-links">
        <Link href={"/forgot-password" as Route}>
          Request a new reset message
        </Link>
      </div>
    </AuthShell>
  );
}
