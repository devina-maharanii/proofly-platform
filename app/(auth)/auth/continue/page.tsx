/** Proofly Phase 11 protected boundary fixture: a verified session has no implied role or product access. */
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { getVerifiedAuthSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account session — Proofly",
  robots: { index: false, follow: false },
};

export default async function AuthContinuePage() {
  const session = await getVerifiedAuthSession();

  return (
    <AuthShell
      eyebrow="Authenticated boundary"
      title="Your session is active."
      description="Authentication confirms an account session only. Product roles, profiles, projects, and account preferences remain intentionally out of scope in this phase."
    >
      <div className="auth-card-header">
        <h2>Secure session</h2>
        <p>Only a verified session can reach this route.</p>
      </div>
      <div className="auth-session-copy">
        <p>
          Signed in as{" "}
          <strong>{session?.email ?? "your confirmed account"}</strong>.
        </p>
        <p>
          You may safely end this device session or request sign-out from active
          sessions.
        </p>
      </div>
      <div className="auth-session-actions">
        <form action={signOutAction}>
          <button className="button button-primary" type="submit">
            Sign out from this device
          </button>
        </form>
        <form action={signOutEverywhereAction}>
          <button className="button button-secondary" type="submit">
            Sign out from active sessions
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
