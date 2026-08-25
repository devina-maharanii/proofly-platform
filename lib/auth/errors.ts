/** Proofly Phase 11: provider errors map to actionable, non-sensitive UI language. */
import type { AuthFormState } from "./types";

export function mapSupabaseAuthError(message: string): AuthFormState {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return {
      status: "error",
      errorCode: "EMAIL_UNCONFIRMED",
      message:
        "Confirm your email before signing in. You can request another confirmation message.",
    };
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return {
      status: "error",
      message:
        "We could not sign you in with those details. Check your email and password, or reset your password.",
    };
  }

  if (normalized.includes("password")) {
    return {
      status: "error",
      message:
        "Use a password that meets the stated requirements, then try again.",
    };
  }

  return {
    status: "error",
    message:
      "This account action could not be completed right now. Please try again shortly.",
  };
}

export const authConfigurationError: AuthFormState = {
  status: "error",
  message:
    "Account access is not configured in this environment. Please try again in the configured app environment.",
};
