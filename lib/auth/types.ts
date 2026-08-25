/** Proofly Phase 11: serializable, role-neutral form state with no password or token echo. */
export type AuthField = "email" | "password" | "confirmPassword";

export type AuthFormState = Readonly<{
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<AuthField, readonly string[]>>;
  values?: Readonly<{ email?: string }>;
  errorCode?: "EMAIL_UNCONFIRMED" | "SESSION_EXPIRED" | "RATE_LIMITED";
}>;

export const initialAuthFormState: AuthFormState = { status: "idle" };
