"use server";

/** Phase 24 application commands: server validates concise Talent input; database functions derive actor, organization, source evidence, terms, eligibility, duplicate prevention, state, and audit truth. */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authorizeActiveContext } from "@/lib/roles/context";
import { securityRateLimiter } from "@/lib/security/rate-limit";
import {
  createServerSupabaseClient,
  getVerifiedAuthSession,
} from "@/lib/supabase/server";

import {
  applicationPath,
  initialApplicationActionState,
  projectApplicationPath,
  type ApplicationActionState,
} from "./types";
import {
  applicationDraftFieldErrors,
  applicationIdSchema,
  parseProjectApplicationForm,
  projectPublicIdSchema,
} from "./validation";

const failure = (
  message: string,
  fieldErrors?: Record<string, string>
): ApplicationActionState => ({ status: "error", message, fieldErrors });

const requestAddress = async () => {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
};

async function applicationCommand() {
  const [session, authorization, supabase] = await Promise.all([
    getVerifiedAuthSession(),
    authorizeActiveContext({ role: "talent" }),
    createServerSupabaseClient(),
  ]);
  if (!session || !supabase) {
    return {
      ok: false as const,
      state: failure("Your session has expired. Sign in again to continue."),
    };
  }
  if (!authorization.ok) {
    return {
      ok: false as const,
      state: failure(
        "Switch to your Talent context to manage a private application."
      ),
    };
  }
  const limit = securityRateLimiter.check(
    "mutation",
    session.userId,
    await requestAddress()
  );
  if (!limit.ok) {
    return {
      ok: false as const,
      state: failure(
        `Too many application changes. Try again in about ${limit.retryAfterSeconds} seconds.`
      ),
    };
  }
  return { ok: true as const, supabase };
}

function refreshApplications(publicId?: string, applicationId?: string) {
  revalidatePath("/applications");
  revalidatePath("/applications/[applicationId]", "page");
  revalidatePath("/projects/[publicId]", "page");
  revalidatePath("/company/applications/[applicationId]", "page");
  if (publicId) revalidatePath(projectApplicationPath(publicId));
  if (applicationId) revalidatePath(applicationPath(applicationId));
}

export async function saveProjectApplicationAction(
  _previousState: ApplicationActionState = initialApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  void _previousState;
  const publicId = formData.get("publicId");
  const parsedPublicId = projectPublicIdSchema.safeParse(publicId);
  if (!parsedPublicId.success)
    return failure("This project is unavailable for a private application.");
  const parsed = parseProjectApplicationForm(formData);
  if (!parsed.success) {
    return failure(
      "Check the highlighted fields and save the private draft again.",
      applicationDraftFieldErrors(parsed.error)
    );
  }
  const applicationIdRaw = formData.get("applicationId");
  const applicationId =
    typeof applicationIdRaw === "string" && applicationIdRaw
      ? applicationIdSchema.safeParse(applicationIdRaw)
      : null;
  if (applicationIdRaw && !applicationId?.success) {
    return failure("This private application draft is unavailable.");
  }
  const command = await applicationCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "save_talent_project_application",
    {
      requested_application_id: applicationId?.success
        ? applicationId.data
        : null,
      requested_public_id: parsedPublicId.data,
      requested_application: {
        evidence_ids: parsed.data.evidenceIds,
        availability: parsed.data.availability,
        timezone_overlap: parsed.data.timezoneOverlap,
        motivation: parsed.data.motivation,
        relevant_experience: parsed.data.relevantExperience,
        project_response: parsed.data.projectResponse,
        approach: parsed.data.approach,
      },
    }
  );
  if (error || !data || typeof data !== "object") {
    const message = error?.message ?? "";
    if (message.includes("DUPLICATE_ACTIVE_APPLICATION")) {
      return failure(
        "You already have an active application for this project. Open it to review its current status."
      );
    }
    if (message.includes("NOT_FOUND_OR_PRIVATE")) {
      return failure(
        "This project is not accepting applications, is private, or has reached its deadline."
      );
    }
    return failure(
      "Your private application draft could not be saved safely. Review the project availability and try again."
    );
  }
  const result = data as { id?: unknown };
  const savedId = typeof result.id === "string" ? result.id : undefined;
  refreshApplications(parsedPublicId.data, savedId);
  return {
    status: "success",
    message:
      "Your private application draft is saved. It has not been sent to the company.",
    applicationId: savedId,
  };
}

export async function submitProjectApplicationAction(
  _previousState: ApplicationActionState = initialApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  void _previousState;
  const rawApplicationId = formData.get("applicationId");
  const applicationId = applicationIdSchema.safeParse(rawApplicationId);
  if (!applicationId.success)
    return failure("This private application draft is unavailable.");
  if (formData.get("confirmProjectTerms") !== "confirmed") {
    return failure(
      "Review the project terms and explicitly confirm them before submitting."
    );
  }
  const command = await applicationCommand();
  if (!command.ok) return command.state;
  const { data, error } = await command.supabase.rpc(
    "submit_talent_project_application",
    {
      requested_application_id: applicationId.data,
      confirmed_project_terms: true,
    }
  );
  if (error || !data || typeof data !== "object") {
    const message = error?.message ?? "";
    if (message.includes("NOT_FOUND_OR_PRIVATE")) {
      return failure(
        "This project is not accepting applications, is private, or has reached its deadline."
      );
    }
    if (message.includes("VALIDATION_FAILED")) {
      return failure(
        "Complete the concise required fields, select at least one relevant evidence item, and save the draft before submitting."
      );
    }
    return failure(
      "The application could not be submitted safely. Try again after reviewing the private draft."
    );
  }
  refreshApplications(undefined, applicationId.data);
  return {
    status: "success",
    message:
      "Your application is submitted. The company’s stated response time is shown in your receipt; Proofly cannot promise a response or outcome.",
    applicationId: applicationId.data,
  };
}

export async function withdrawProjectApplicationAction(
  _previousState: ApplicationActionState = initialApplicationActionState,
  formData: FormData
): Promise<ApplicationActionState> {
  void _previousState;
  const applicationId = applicationIdSchema.safeParse(
    formData.get("applicationId")
  );
  if (!applicationId.success)
    return failure("This private application is unavailable.");
  const command = await applicationCommand();
  if (!command.ok) return command.state;
  const { error } = await command.supabase.rpc(
    "withdraw_talent_project_application",
    {
      requested_application_id: applicationId.data,
    }
  );
  if (error) {
    return failure(
      "This application cannot be withdrawn in its current state. The authorized record remains private and auditable."
    );
  }
  refreshApplications(undefined, applicationId.data);
  return {
    status: "success",
    message:
      "Your application is withdrawn. The company keeps only its authorized record, and no application content becomes public.",
    applicationId: applicationId.data,
  };
}
