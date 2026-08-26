/** Phase 26 validation: bounded server-side task, private-file, and submission inputs; browser labels never establish ownership, storage paths, state, or visibility. */
import { z } from "zod";

const uuid = z.string().uuid();

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export const workspaceTaskStates = [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export const parseWorkspaceTaskForm = (formData: FormData) =>
  z
    .object({
      workspaceId: uuid,
      title: z.string().trim().min(1).max(160),
      description: z.string().max(1000),
      priority: z.enum(["low", "normal", "high"]),
      dueDate: z.string().date().optional().or(z.literal("")),
      acceptanceCriteria: z.string().max(1200),
    })
    .safeParse({
      workspaceId: text(formData, "workspaceId"),
      title: text(formData, "title"),
      description: text(formData, "description"),
      priority: text(formData, "priority") || "normal",
      dueDate: text(formData, "dueDate"),
      acceptanceCriteria: text(formData, "acceptanceCriteria"),
    });

export const parseWorkspaceTaskTransitionForm = (formData: FormData) =>
  z.object({ taskId: uuid, state: z.enum(workspaceTaskStates) }).safeParse({
    taskId: text(formData, "taskId"),
    state: text(formData, "state"),
  });

export const parseWorkspaceSubmissionForm = (formData: FormData) =>
  z
    .object({
      workspaceId: uuid,
      taskId: uuid.optional().or(z.literal("")),
      summary: z.string().max(1000),
      problemInterpretation: z.string().max(1400),
      approachAndDecisions: z.string().max(1800),
      deliverables: z.string().max(1400),
      demoOrRepositoryLink: z.string().url().optional().or(z.literal("")),
      knownLimitations: z.string().max(1400),
      completionContext: z.string().max(700),
      ownershipConfirmed: z.boolean(),
      attributionConfirmed: z.boolean(),
      fileVersionIds: z
        .array(uuid)
        .max(8)
        .refine(values => new Set(values).size === values.length),
    })
    .safeParse({
      workspaceId: text(formData, "workspaceId"),
      taskId: text(formData, "taskId"),
      summary: text(formData, "summary"),
      problemInterpretation: text(formData, "problemInterpretation"),
      approachAndDecisions: text(formData, "approachAndDecisions"),
      deliverables: text(formData, "deliverables"),
      demoOrRepositoryLink: text(formData, "demoOrRepositoryLink"),
      knownLimitations: text(formData, "knownLimitations"),
      completionContext: text(formData, "completionContext"),
      ownershipConfirmed: formData.get("ownershipConfirmed") === "confirmed",
      attributionConfirmed:
        formData.get("attributionConfirmed") === "confirmed",
      fileVersionIds: formData
        .getAll("fileVersionIds")
        .filter((value): value is string => typeof value === "string"),
    });
