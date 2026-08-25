"use client";

/** Proofly Phase 11 auth form: short, keyboard-first server-action fields with inline, non-sensitive feedback. */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialAuthFormState, type AuthFormState } from "@/lib/auth/types";

type AuthAction = (
  state: AuthFormState,
  formData: FormData
) => Promise<AuthFormState>;

type AuthFormProps = Readonly<{
  action: AuthAction;
  submitLabel: string;
  showPassword?: boolean;
  showPasswordConfirmation?: boolean;
  showEmail?: boolean;
  emailHint?: string;
  next?: string;
  initialEmail?: string;
}>;

function AuthSubmit({ label }: Readonly<{ label: string }>) {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

function FieldError({
  id,
  errors,
}: Readonly<{ id: string; errors?: readonly string[] }>) {
  if (!errors?.[0]) {
    return null;
  }

  return (
    <p id={id} className="auth-field-error">
      {errors[0]}
    </p>
  );
}

export function AuthForm({
  action,
  submitLabel,
  showPassword = false,
  showPasswordConfirmation = false,
  showEmail = true,
  emailHint,
  next,
  initialEmail,
}: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialAuthFormState);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;
  const confirmPasswordError = state.fieldErrors?.confirmPassword;

  return (
    <form className="auth-form" action={formAction} noValidate>
      {next ? <input name="next" type="hidden" value={next} /> : null}
      {showEmail ? (
        <div className="auth-field">
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.values?.email ?? initialEmail ?? ""}
            aria-invalid={Boolean(emailError)}
            aria-describedby={
              emailError
                ? "auth-email-error"
                : emailHint
                  ? "auth-email-hint"
                  : undefined
            }
            required
          />
          {emailHint ? (
            <p id="auth-email-hint" className="auth-field-hint">
              {emailHint}
            </p>
          ) : null}
          <FieldError id="auth-email-error" errors={emailError} />
        </div>
      ) : null}

      {showPassword ? (
        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={
              showPasswordConfirmation ? "new-password" : "current-password"
            }
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "auth-password-error" : undefined}
            required
          />
          <FieldError id="auth-password-error" errors={passwordError} />
        </div>
      ) : null}

      {showPasswordConfirmation ? (
        <div className="auth-field">
          <label htmlFor="auth-confirm-password">Confirm password</label>
          <input
            id="auth-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(confirmPasswordError)}
            aria-describedby={
              confirmPasswordError ? "auth-confirm-password-error" : undefined
            }
            required
          />
          <p className="auth-field-hint">Use 12 to 128 characters.</p>
          <FieldError
            id="auth-confirm-password-error"
            errors={confirmPasswordError}
          />
        </div>
      ) : null}

      {state.status !== "idle" && state.message ? (
        <p
          className="auth-status"
          data-status={state.status}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <AuthSubmit label={submitLabel} />
    </form>
  );
}
