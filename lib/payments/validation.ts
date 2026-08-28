/** Phase 34 validation: bounded IDs and refund rationale only; never collect card, bank, tax, or credential data. */
import { z } from "zod";

const uuid = z.string().uuid();
const compact = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const parseEngagementPaymentForm = (formData: FormData) =>
  z
    .object({ engagementId: uuid })
    .safeParse({ engagementId: formData.get("engagementId") });

export const parsePaymentReleaseForm = (formData: FormData) =>
  z.object({ engagementId: uuid, milestoneId: uuid }).safeParse({
    engagementId: formData.get("engagementId"),
    milestoneId: formData.get("milestoneId"),
  });

export const parsePaymentRefundForm = (formData: FormData) =>
  z
    .object({
      paymentIntentId: uuid,
      amountMinor: z.string().regex(/^[1-9][0-9]{0,14}$/),
      reason: compact(20, 1200),
    })
    .safeParse({
      paymentIntentId: formData.get("paymentIntentId"),
      amountMinor: formData.get("amountMinor"),
      reason: formData.get("reason"),
    });

export const parsePlatformPaymentDisputeForm = (formData: FormData) =>
  z
    .object({
      paymentIntentId: uuid,
      engagementDisputeId: uuid,
      reason: compact(30, 1600),
    })
    .safeParse({
      paymentIntentId: formData.get("paymentIntentId"),
      engagementDisputeId: formData.get("engagementDisputeId"),
      reason: formData.get("reason"),
    });
