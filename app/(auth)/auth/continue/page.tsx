/** Proofly Phase 11 protected boundary fixture: a verified session has no implied role or product access. */
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RoleContextSwitcher } from "@/components/roles/context-switcher";
import { signOutAction, signOutEverywhereAction } from "@/lib/auth/actions";
import { getRoleContext } from "@/lib/roles/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account session — Proofly",
  robots: { index: false, follow: false },
};

type AuthContinuePageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AuthContinuePage({
  searchParams,
}: AuthContinuePageProps) {
  const [context, params] = await Promise.all([getRoleContext(), searchParams]);
  const status = typeof params.status === "string" ? params.status : undefined;
  const notice =
    status === "context-updated"
      ? "Your active context is updated. Future role-specific workspaces will honor this choice."
      : status === "reviewer-requested"
        ? "Reviewer access remains pending until qualified human review approves it."
        : undefined;

  return (
    <AuthShell
      eyebrow="Account context"
      title="Choose the context for this session."
      description="One person may hold more than one approved capability. Each action uses one explicit context, and no selection grants a role that has not been authorized."
    >
      <div className="auth-card-header">
        <h2>Your available contexts</h2>
        <p>
          {context?.email
            ? `Signed in as ${context.email}.`
            : "Only a verified session can reach this route."}
        </p>
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
      {context ? <RoleContextSwitcher context={context} /> : null}
      <p className="auth-footnote">
        Selecting a context is reversible. It does not create a profile,
        project, payment, review, or administrator privilege.
      </p>
      <div className="auth-session-actions">
        <a className="button button-secondary" href="/settings">
          Account settings
        </a>
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
