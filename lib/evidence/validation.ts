import { z } from "zod";

import { canonicalSkills } from "@/lib/profile/types";

import {
  workEvidenceLinkAvailabilities,
  workEvidenceLinkTypes,
  workEvidenceOwnershipStatuses,
  workEvidenceTypes,
} from "./types";

const secureOptionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine(value => !value || /^https:\/\//.test(value), {
    message: "Use a secure HTTPS URL or leave this field blank.",
  });

const skillKeys = canonicalSkills.map(skill => skill.key) as [
  string,
  ...string[],
];

const jsonArray = (formData: FormData, key: string): unknown[] => {
  const value = formData.get(key);
  if (typeof value !== "string" || !value || value.length > 12000) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export const workEvidenceInputSchema = z
  .object({
    title: z.string().trim().max(120),
    shortSummary: z.string().trim().max(360),
    evidenceType: z.enum(workEvidenceTypes),
    problemGoal: z.string().trim().max(1200),
    userRole: z.string().trim().max(120),
    personalContribution: z.string().trim().max(1600),
    contributionScope: z.string().trim().max(700),
    contextConstraints: z.string().trim().max(1200),
    decisionsTradeoffs: z.string().trim().max(1400),
    outcomeStatus: z.string().trim().max(900),
    teamWork: z.boolean(),
    ownershipStatus: z.enum(workEvidenceOwnershipStatuses),
    permissionNote: z.string().trim().max(500),
    startedOn: z
      .string()
      .trim()
      .refine(
        value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
        "Use a valid date or leave this field blank."
      ),
    durationText: z.string().trim().max(120),
    skills: z
      .array(
        z.object({
          skillKey: z.enum(skillKeys),
          context: z.string().trim().max(360),
        })
      )
      .max(12)
      .refine(
        skills =>
          new Set(skills.map(skill => skill.skillKey)).size === skills.length,
        { message: "Choose each canonical skill only once.", path: ["skills"] }
      ),
    links: z
      .array(
        z
          .object({
            linkType: z.enum(workEvidenceLinkTypes),
            label: z.string().trim().max(100),
            url: secureOptionalUrl,
            availability: z.enum(workEvidenceLinkAvailabilities),
            isPublic: z.boolean(),
          })
          .superRefine((link, context) => {
            if (link.availability === "available" && !link.url) {
              context.addIssue({
                code: "custom",
                path: ["url"],
                message: "An available link needs a secure HTTPS URL.",
              });
            }
          })
      )
      .max(8)
      .refine(
        links =>
          new Set(links.filter(link => link.url).map(link => link.url)).size ===
          links.filter(link => link.url).length,
        { message: "Add each link URL only once.", path: ["links"] }
      ),
    attributions: z
      .array(
        z.object({
          contributorName: z.string().trim().min(1).max(120),
          contributorRole: z.string().trim().max(120),
          sourceReferenceUrl: secureOptionalUrl,
          isPublic: z.boolean(),
        })
      )
      .max(12)
      .refine(
        attributions =>
          new Set(
            attributions.map(attribution =>
              attribution.contributorName.toLowerCase()
            )
          ).size === attributions.length,
        { message: "Name each contributor only once.", path: ["attributions"] }
      ),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.teamWork && evidence.attributions.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["attributions"],
        message:
          "Team work needs at least one collaborator or source attribution.",
      });
    }
    if (
      evidence.ownershipStatus !== "owns" &&
      evidence.permissionNote.length < 10
    ) {
      context.addIssue({
        code: "custom",
        path: ["permissionNote"],
        message:
          "Explain the permission or reference boundary before sharing work you do not own.",
      });
    }
  });

export type WorkEvidenceInput = z.infer<typeof workEvidenceInputSchema>;

export const parseWorkEvidenceForm = (formData: FormData) =>
  workEvidenceInputSchema.safeParse({
    title: text(formData, "title"),
    shortSummary: text(formData, "shortSummary"),
    evidenceType: text(formData, "evidenceType"),
    problemGoal: text(formData, "problemGoal"),
    userRole: text(formData, "userRole"),
    personalContribution: text(formData, "personalContribution"),
    contributionScope: text(formData, "contributionScope"),
    contextConstraints: text(formData, "contextConstraints"),
    decisionsTradeoffs: text(formData, "decisionsTradeoffs"),
    outcomeStatus: text(formData, "outcomeStatus"),
    teamWork: text(formData, "teamWork") === "true",
    ownershipStatus: text(formData, "ownershipStatus"),
    permissionNote: text(formData, "permissionNote"),
    startedOn: text(formData, "startedOn"),
    durationText: text(formData, "durationText"),
    skills: jsonArray(formData, "skills"),
    links: jsonArray(formData, "links"),
    attributions: jsonArray(formData, "attributions"),
  });

export const workEvidenceFieldErrors = (error: z.ZodError) =>
  Object.fromEntries(
    error.issues.map(issue => [String(issue.path[0] ?? "form"), issue.message])
  );

export const evidenceIdSchema = z.string().uuid();
