/** Proofly Phase 13 product surface: organization setup is a focused first step, not a company dashboard. */
"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { startCompanyOnboardingAction } from "@/lib/onboarding/actions";
import { initialOnboardingActionState } from "@/lib/onboarding/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? "Setting up…" : "Create organization context"}
    </button>
  );
}

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export function CompanyStart() {
  const [state, formAction] = useActionState(
    startCompanyOnboardingAction,
    initialOnboardingActionState
  );
  const [name, setName] = useState("");
  const suggestedSlug = useMemo(() => slugFromName(name), [name]);
  const [slug, setSlug] = useState("");
  const activeSlug = slug || suggestedSlug;

  return (
    <form className="onboarding-form" action={formAction}>
      <div className="auth-card-header">
        <h2>Start with your organization</h2>
        <p>
          This creates a private organization context and makes you its initial
          owner. It does not create a project, billing profile, or public page.
        </p>
      </div>
      <div className="auth-field">
        <label htmlFor="organizationName">Organization name</label>
        <input
          id="organizationName"
          name="organizationName"
          value={name}
          onChange={event => setName(event.target.value)}
          autoComplete="organization"
          aria-invalid={Boolean(state.fieldErrors?.organizationName)}
          aria-describedby={
            state.fieldErrors?.organizationName
              ? "organizationName-error"
              : "organizationName-hint"
          }
        />
        <p className="auth-field-hint" id="organizationName-hint">
          Use the company or team name people should recognize internally.
        </p>
        {state.fieldErrors?.organizationName ? (
          <p
            className="auth-field-error"
            id="organizationName-error"
            role="alert"
          >
            {state.fieldErrors.organizationName}
          </p>
        ) : null}
      </div>
      <div className="auth-field">
        <label htmlFor="organizationSlug">Private organization address</label>
        <input
          id="organizationSlug"
          name="organizationSlug"
          value={activeSlug}
          onChange={event => setSlug(slugFromName(event.target.value))}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.organizationSlug)}
          aria-describedby={
            state.fieldErrors?.organizationSlug
              ? "organizationSlug-error"
              : "organizationSlug-hint"
          }
        />
        <p className="auth-field-hint" id="organizationSlug-hint">
          Lowercase words and hyphens only. You can review your organization
          details before any future public use.
        </p>
        {state.fieldErrors?.organizationSlug ? (
          <p
            className="auth-field-error"
            id="organizationSlug-error"
            role="alert"
          >
            {state.fieldErrors.organizationSlug}
          </p>
        ) : null}
      </div>
      {state.status === "error" && state.message ? (
        <p className="auth-status" data-status="error" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
