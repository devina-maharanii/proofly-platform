/** Phase 24 validation: concise, project-specific application fields only; no resume duplication, uploads, long cover letter, protected-characteristic prompts, or application artifacts. */
import { z } from "zod";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const idList = (formData: FormData) => {
  const value = formData.get("evidenceIds");
  if (typeof value !== "string" || !value || value.length > 4000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const applicationIdSchema = z.string().uuid();
export const projectPublicIdSchema = z.string().regex(/^prj_[a-f0-9]{20,40}$/);

export const projectApplicationInputSchema = z
  .object({
    evidenceIds: z
      .array(z.string().uuid())
      .max(6)
      .refine(ids => new Set(ids).size === ids.length, {
        message: "Choose each evidence item only once.",
      }),
    availability: z.string().trim().max(240),
    timezoneOverlap: z.string().trim().max(160),
    motivation: z.string().trim().max(600),
    relevantExperience: z.string().trim().max(900),
    projectResponse: z.string().trim().max(800),
    approach: z.string().trim().max(1000),
  })
  .strict();

export type ProjectApplicationInput = z.infer<
  typeof projectApplicationInputSchema
>;

export const parseProjectApplicationForm = (formData: FormData) =>
  projectApplicationInputSchema.safeParse({
    evidenceIds: idList(formData),
    availability: text(formData, "availability"),
    timezoneOverlap: text(formData, "timezoneOverlap"),
    motivation: text(formData, "motivation"),
    relevantExperience: text(formData, "relevantExperience"),
    projectResponse: text(formData, "projectResponse"),
    approach: text(formData, "approach"),
  });

export const applicationDraftFieldErrors = (error: z.ZodError) =>
  Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );
