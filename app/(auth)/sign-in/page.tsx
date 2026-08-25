/** Proofly Phase 11 sign-in route: direct account entry with recovery and unverified-account paths. */
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signInAction, startGoogleSignInAction } from "@/lib/auth/actions";
import { googleOAuthEnabled } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in — Proofly",
  description: "Securely sign in to your Proofly account or recover access.",
  robots: { index: false, follow: false },
};

type SignInPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const status = readSearchParam(params.status);
  const error = readSearchParam(params.error);
  const next = readSearchParam(params.next);
  const notice =
    status === "password-reset"
      ? "Your password has been updated. Sign in with it to continue."
      : status === "signed-out"
        ? "You have signed out from this device."
        : status === "signed-out-all"
          ? "You have signed out from active sessions where supported."
          : error === "session-expired"
            ? "Your session has expired. Sign in again to continue safely."
            : error === "callback"
              ? "That sign-in link is no longer valid. Request a new one or sign in again."
              : error === "oauth-unavailable"
                ? "Google sign-in is not available in this environment. Use email and password instead."
                : error === "auth-unavailable"
                  ? "Account access is not configured in this environment."
                  : undefined;

  return (
    <AuthShell
      eyebrow="Account access"
      title="Return to the context you control."
      description="Sign in to manage your own account session. This does not select a product role or publish any information."
    >
      <div className="auth-card-header">
        <h2>Sign in</h2>
        <p>Use the email and password associated with your account.</p>
      </div>
      {notice ? (
        <p
          className="auth-status"
          data-status="success"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        showPassword
        next={next}
      />
      {googleOAuthEnabled ? (
        <>
          <p className="auth-divider">or</p>
          <form action={startGoogleSignInAction}>
            <button className="button button-secondary" type="submit">
              Continue with Google
            </button>
          </form>
        </>
      ) : null}
      <div className="auth-links">
        <Link href={"/forgot-password" as Route}>Forgot your password?</Link>
        <Link href={"/verify-email" as Route}>Need to confirm your email?</Link>
        <Link href={"/get-started" as Route}>Create an account</Link>
      </div>
    </AuthShell>
  );
}
