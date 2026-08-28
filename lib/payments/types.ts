/** Phase 34 vocabulary: private, provider-verified financial coordination; no browser-derived money state. */

export const paymentIntentStates = [
  "required",
  "checkout_created",
  "payment_processing",
  "funded",
  "funding_failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "on_hold",
  "disputed",
  "provider_review",
  "requires_action",
  "reconciled",
] as const;
export type PaymentIntentState = (typeof paymentIntentStates)[number];

export const paymentReleaseStates = [
  "eligible_for_release",
  "release_processing",
  "released",
  "release_failed",
  "on_hold",
  "cancelled",
  "reconciled",
] as const;
export type PaymentReleaseState = (typeof paymentReleaseStates)[number];

export const payoutStates = [
  "created",
  "provider_pending",
  "eligible",
  "paid",
  "failed",
  "held",
  "reversed",
  "reconciled",
] as const;
export type PayoutState = (typeof payoutStates)[number];

export type Money = Readonly<{
  amountMinor: number;
  currency: string;
}>;

export type PaymentActionState = Readonly<{
  status: "idle" | "success" | "error";
  message: string;
  paymentIntentId?: string;
  paymentReleaseId?: string;
  payoutAccountId?: string;
  redirectPath?: string;
}>;

export const initialPaymentActionState: PaymentActionState = {
  status: "idle",
  message: "",
};

export type EngagementPaymentStatus = Readonly<{
  engagementId: string;
  isBillingParty: boolean;
  marketPaymentAvailable: boolean;
  fundingState: string;
  paymentIntent:
    | (Money &
        Readonly<{
          id: string;
          state: PaymentIntentState;
          platformFeeMinor: number;
          providerFeeMinor: number;
          taxAmountMinor: number;
          fundingTotalMinor: number;
          expectedTalentNetMinor: number;
          checkoutExpiresAt: string | null;
          fundedAt: string | null;
        }>)
    | null;
  releases: Array<
    Money &
      Readonly<{
        id: string;
        milestoneId: string;
        state: PaymentReleaseState;
        providerFeeMinor: number;
        taxWithholdingMinor: number;
        expectedTalentNetMinor: number;
        releasedAt: string | null;
      }>
  >;
  refunds: Array<
    Money &
      Readonly<{
        id: string;
        state: string;
        requestedAt: string | null;
        refundedAt: string | null;
      }>
  >;
  disputeHold: boolean;
  receipts: Array<
    Money &
      Readonly<{
        id: string;
        type: string;
        statusLabel: string;
        issuedAt: string | null;
      }>
  >;
}>;

export type CompanyBillingOverview = Readonly<{
  organizationId: string;
  billingProfile: Readonly<{
    id: string;
    status: string;
    isAuthorizedPayer: boolean;
    policyAcknowledgedAt: string | null;
  }> | null;
  spendControls: Array<
    Money &
      Readonly<{
        state: string;
        perPaymentLimitMinor: number;
        periodLimitMinor: number;
        periodStartsAt: string | null;
        periodEndsAt: string | null;
      }>
  >;
  payments: Array<
    Money &
      Readonly<{
        id: string;
        engagementId: string;
        state: PaymentIntentState;
        fundingTotalMinor: number;
        createdAt: string | null;
        fundedAt: string | null;
      }>
  >;
  sandboxModeOnly: boolean;
}>;

export type PrivatePayoutStatus = Readonly<{
  payoutAccounts: Array<
    Readonly<{
      id: string;
      state: string;
      requirementsStatusCode: string;
      lastVerifiedAt: string | null;
    }>
  >;
  payouts: Array<
    Money &
      Readonly<{
        id: string;
        state: PayoutState;
        paidAt: string | null;
        createdAt: string | null;
      }>
  >;
  sandboxModeOnly: boolean;
  payoutDestinationDisclosure: string;
}>;

export type PaymentReconciliationQueue = Readonly<{
  runs: Array<
    Readonly<{
      id: string;
      state: string;
      createdAt: string | null;
      startedAt: string | null;
      completedAt: string | null;
    }>
  >;
  items: Array<
    Readonly<{
      id: string;
      runId: string;
      state: string;
      reasonCode: string;
      createdAt: string | null;
      resolvedAt: string | null;
    }>
  >;
  deadLetters: Array<
    Readonly<{
      id: string;
      eventType: string;
      normalizedEventType: string;
      failureCode: string | null;
      receivedAt: string | null;
      retryCount: number;
    }>
  >;
}>;

export const money = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
