"use client";

/** Proofly Phase 12 context switcher: displays only server-derived capabilities and memberships; all changes are re-authorized server-side. */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Route } from "next";

import {
  initialRoleActionState,
  setActiveContextAction,
} from "@/lib/roles/actions";
import type { RoleContext } from "@/lib/roles/types";

function PendingButton({
  label,
  className = "button button-secondary",
  disabled = false,
}: Readonly<{ label: string; className?: string; disabled?: boolean }>) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending || disabled}>
      {pending ? "Updating…" : label}
    </button>
  );
}

function ContextOption({
  role,
  organizationId,
  title,
  detail,
  selected,
  actionLabel,
}: Readonly<{
  role: "talent" | "company_member" | "reviewer" | "administrator";
  organizationId?: string;
  title: string;
  detail: string;
  selected: boolean;
  actionLabel: string;
}>) {
  const [state, formAction] = useActionState(
    setActiveContextAction,
    initialRoleActionState
  );

  return (
    <form className="context-option" action={formAction}>
      <input name="role" type="hidden" value={role} />
      {organizationId ? (
        <input name="organizationId" type="hidden" value={organizationId} />
      ) : null}
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      {selected ? (
        <span className="context-selected" aria-label="Current active context">
          Active
        </span>
      ) : (
        <PendingButton label={actionLabel} />
      )}
      {state.status === "error" && state.message ? (
        <p className="auth-field-error context-option-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function RoleContextSwitcher({
  context,
}: Readonly<{ context: RoleContext }>) {
  return (
    <div className="context-switcher">
      <div className="context-list" aria-label="Available role contexts">
        <ContextOption
          role="talent"
          title="Talent"
          detail="Personal context for the future proof-to-opportunity path. It does not publish a profile or create an application."
          selected={context.active?.role === "talent"}
          actionLabel="Use talent context"
        />

        <article className="context-option">
          <div>
            <h3>Talent onboarding</h3>
            <p>
              Save a few private preferences before a future proof path. This
              does not publish a profile.
            </p>
          </div>
          <Link
            className="button button-secondary"
            href={"/onboarding" as Route}
          >
            Continue onboarding
          </Link>
        </article>

        {context.memberships.map(membership => (
          <ContextOption
            key={membership.organizationId}
            role="company_member"
            organizationId={membership.organizationId}
            title={membership.organizationName}
            detail={`Company member · ${membership.permissions.join(", ")}`}
            selected={
              context.active?.role === "company_member" &&
              context.active.organizationId === membership.organizationId
            }
            actionLabel="Use organization"
          />
        ))}

        {context.memberships.length === 0 ? (
          <article className="context-option">
            <div>
              <h3>Company onboarding</h3>
              <p>
                Create one private organization context before selecting future
                company actions.
              </p>
            </div>
            <Link
              className="button button-secondary"
              href={"/onboarding?role=company_member" as Route}
            >
              Set up organization
            </Link>
          </article>
        ) : null}

        {context.capabilities.includes("reviewer") ? (
          <ContextOption
            role="reviewer"
            title="Reviewer"
            detail="Approved reviewer context. Assignment eligibility and conflict checks remain separate safeguards."
            selected={context.active?.role === "reviewer"}
            actionLabel="Use reviewer context"
          />
        ) : (
          <article className="context-option">
            <div>
              <h3>Reviewer access</h3>
              <p>
                {context.reviewerRequestStatus === "pending"
                  ? "Your request is pending qualified human review."
                  : "Prepare your expertise request before qualified human review considers access."}
              </p>
            </div>
            {context.reviewerRequestStatus === "pending" ? (
              <span className="context-selected">Request pending</span>
            ) : (
              <Link
                className="button button-secondary"
                href={"/onboarding?role=reviewer" as Route}
              >
                Prepare reviewer request
              </Link>
            )}
          </article>
        )}

        {context.capabilities.includes("administrator") ? (
          <ContextOption
            role="administrator"
            title="Administrator"
            detail="Elevated operational context. It does not bypass RLS, privacy, or auditable policy controls."
            selected={context.active?.role === "administrator"}
            actionLabel="Use administrator context"
          />
        ) : null}
      </div>
    </div>
  );
}
