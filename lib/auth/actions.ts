"use server";

/** Proofly Phase 11: server-only, role-neutral account actions; no passwords or tokens are logged or returned. */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { mapSupabaseAuthError, authConfigurationError } from "./errors";
import { authRateLimiter, type AuthRateLimitAction } from "./rate-limit";
import { authCallbackUrl, safeAuthRedirect } from "./redirects";
import { initialAuthFormState, type AuthFormState } from "./types";
import {
  emailSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  validationErrors,
} from "./validation";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

function redirectTo(url: string): never {
  return redirect(url as never);
}

function getFieldValues(formData: FormData) {
  return {
    email:
      typeof formData.get("email") === "string"
        ? String(formData.get("email"))
        : "",
    password:
      typeof formData.get("password") === "string"
        ? String(formData.get("password"))
        : "",
    confirmPassword:
      typeof formData.get("confirmPassword") === "string"
        ? String(formData.get("confirmPassword"))
        : "",
    next:
      typeof formData.get("next") === "string"
        ? String(formData.get("next"))
        : "",
  };
}

function withEmail(state: AuthFormState, email: string): AuthFormState {
  return { ...state, values: email ? { email } : undefined };
}

async function requestAddress() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function enforceRateLimit(
  action: AuthRateLimitAction,
  email: string
): Promise<AuthFormState | null> {
  const result = authRateLimiter.check(action, email, await requestAddress());
  if (result.ok) {
    return null;
  }

  return {
    status: "error",
    errorCode: "RATE_LIMITED",
    message: `Please wait about ${result.retryAfterSeconds} seconds before trying again.`,
  };
}

export async function signUpAction(
  _previousState: AuthFormState = initialAuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void _previousState;
  const values = getFieldValues(formData);
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) {
    return withEmail(
      {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: validationErrors(parsed.error),
      },
      values.email
    );
  }

  const rateLimitError = await enforceRateLimit("sign-up", parsed.data.email);
  if (rateLimitError) {
    return withEmail(rateLimitError, parsed.data.email);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return withEmail(authConfigurationError, parsed.data.email);
  }

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: authCallbackUrl("/verify-email"),
    },
  });

  if (error) {
    return withEmail(mapSupabaseAuthError(error.message), parsed.data.email);
  }

  redirectTo("/verify-email?status=sent");
}

export async function signInAction(
  _previousState: AuthFormState = initialAuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void _previousState;
  const values = getFieldValues(formData);
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) {
    return withEmail(
      {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: validationErrors(parsed.error),
      },
      values.email
    );
  }

  const rateLimitError = await enforceRateLimit("sign-in", parsed.data.email);
  if (rateLimitError) {
    return withEmail(rateLimitError, parsed.data.email);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return withEmail(authConfigurationError, parsed.data.email);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return withEmail(mapSupabaseAuthError(error.message), parsed.data.email);
  }

  redirectTo(safeAuthRedirect(parsed.data.next, "/auth/continue"));
}

export async function requestPasswordResetAction(
  _previousState: AuthFormState = initialAuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void _previousState;
  const values = getFieldValues(formData);
  const parsed = emailSchema.safeParse(values);
  if (!parsed.success) {
    return withEmail(
      {
        status: "error",
        message: "Enter a valid email address to continue.",
        fieldErrors: validationErrors(parsed.error),
      },
      values.email
    );
  }

  const rateLimitError = await enforceRateLimit(
    "password-reset",
    parsed.data.email
  );
  if (rateLimitError) {
    return withEmail(rateLimitError, parsed.data.email);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return withEmail(authConfigurationError, parsed.data.email);
  }

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: authCallbackUrl("/reset-password"),
  });

  return withEmail(
    {
      status: "success",
      message:
        "If an account uses that email, you will receive instructions to reset its password.",
    },
    parsed.data.email
  );
}

export async function resendVerificationAction(
  _previousState: AuthFormState = initialAuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void _previousState;
  const values = getFieldValues(formData);
  const parsed = emailSchema.safeParse(values);
  if (!parsed.success) {
    return withEmail(
      {
        status: "error",
        message: "Enter a valid email address to request another message.",
        fieldErrors: validationErrors(parsed.error),
      },
      values.email
    );
  }

  const rateLimitError = await enforceRateLimit(
    "verification-resend",
    parsed.data.email
  );
  if (rateLimitError) {
    return withEmail(rateLimitError, parsed.data.email);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return withEmail(authConfigurationError, parsed.data.email);
  }

  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: authCallbackUrl("/verify-email") },
  });

  return withEmail(
    {
      status: "success",
      message:
        "If a pending account uses that email, another confirmation message will arrive shortly.",
    },
    parsed.data.email
  );
}

export async function resetPasswordAction(
  _previousState: AuthFormState = initialAuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  void _previousState;
  const values = getFieldValues(formData);
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: validationErrors(parsed.error),
    };
  }

  const session = await getVerifiedAuthSession();
  if (!session) {
    return {
      status: "error",
      errorCode: "SESSION_EXPIRED",
      message:
        "This password-reset session has expired. Request a new reset message to continue.",
    };
  }

  const rateLimitError = await enforceRateLimit(
    "password-update",
    session.userId
  );
  if (rateLimitError) {
    return rateLimitError;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authConfigurationError;
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return mapSupabaseAuthError(error.message);
  }

  redirectTo("/sign-in?status=password-reset");
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }
  redirectTo("/sign-in?status=signed-out");
}

export async function signOutEverywhereAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut({ scope: "global" });
  }
  redirectTo("/sign-in?status=signed-out-all");
}

export async function startGoogleSignInAction() {
  const rateLimitError = await enforceRateLimit("sign-in", "google-oauth");
  if (rateLimitError) {
    redirectTo("/sign-in?error=oauth-unavailable");
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirectTo("/sign-in?error=auth-unavailable");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authCallbackUrl("/auth/continue") },
  });

  if (error || !data.url) {
    redirectTo("/sign-in?error=oauth-unavailable");
  }

  redirectTo(data.url);
}
