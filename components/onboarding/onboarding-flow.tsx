/** Proofly Phase 13 product surface: progressive, private onboarding with server-confirmed saves and no profile publication. */
"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  saveActiveOnboardingAction,
  saveReviewerOnboardingAction,
} from "@/lib/onboarding/actions";
import {
  companyMemberRoles,
  initialOnboardingActionState,
  reviewerExpertiseAreas,
  talentGoals,
  type OnboardingDraft,
  type OnboardingProgress,
  type OnboardingRole,
} from "@/lib/onboarding/types";
import {
  getResumeStepIndex,
  validateOnboardingStep,
} from "@/lib/onboarding/validation";

type Step = Readonly<{
  key: "identity" | "purpose" | "notifications" | "role" | "review";
  label: string;
  reason: string;
}>;

const commonSteps: Step[] = [
  {
    key: "identity",
    label: "Name",
    reason:
      "So your account can address you clearly. This stays private by default.",
  },
  {
    key: "purpose",
    label: "Purpose",
    reason:
      "This helps keep your first action relevant without inferring your ability or eligibility.",
  },
  {
    key: "notifications",
    label: "Preferences",
    reason: "Choose a timezone and notification defaults you can change later.",
  },
];

const roleStep: Step = {
  key: "role",
  label: "Focus",
  reason: "Only ask for information needed to orient your next safe action.",
};
const reviewStep: Step = {
  key: "review",
  label: "Review",
  reason: "Review what stays private before saving your onboarding state.",
};

const roleLabels: Record<OnboardingRole, string> = {
  talent: "Talent",
  company_member: "Company",
  reviewer: "Reviewer",
};

const recommendation: Record<
  OnboardingRole,
  { title: string; body: string; next: string }
> = {
  talent: {
    title: "Prepare your first proof path",
    body: "Your onboarding details are private. When bounded proof work is enabled, return here to choose work that fits the focus and goal you selected.",
    next: "Return to account context",
  },
  company_member: {
    title: "Keep your organization context ready",
    body: "Your organization membership is now explicit. Project creation and talent discovery are not part of this onboarding phase, so no project has been created.",
    next: "Return to account context",
  },
  reviewer: {
    title: "Wait for qualified human review",
    body: "Your reviewer request is recorded, but reviewer access remains locked until an authorized human approval occurs. No review assignment has been created.",
    next: "Return to account context",
  },
};

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Readonly<{ value: string; label: string }>[];
  hint: string;
  error?: string;
}>) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      >
        <option value="">Choose one</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="auth-field-hint" id={`${id}-hint`}>
        {hint}
      </p>
      {error ? (
        <p className="auth-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onChange,
  error,
}: Readonly<{
  label: string;
  options: readonly Readonly<{ value: string; label: string }>[];
  selected: string[];
  onChange: (values: string[]) => void;
  error?: string;
}>) {
  return (
    <fieldset
      className="onboarding-check-group"
      aria-describedby={error ? "choice-error" : undefined}
    >
      <legend>{label}</legend>
      <div className="onboarding-check-list">
        {options.map(option => {
          const checked = selected.includes(option.value);
          return (
            <label className="onboarding-check" key={option.value}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter(value => value !== option.value)
                      : [...selected, option.value]
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="auth-field-error" id="choice-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function OnboardingFlow({
  role,
  progress,
  reviewerRequestStatus,
}: Readonly<{
  role: OnboardingRole;
  progress: OnboardingProgress | null;
  reviewerRequestStatus:
    "pending" | "approved" | "declined" | "withdrawn" | null;
}>) {
  const steps = useMemo(() => [...commonSteps, roleStep, reviewStep], []);
  const [draft, setDraft] = useState<OnboardingDraft>(
    progress?.draft ?? {
      fullName: "",
      displayName: "",
      primaryPurpose: "",
      timezone: "",
      locale: "en",
      notificationEmail: true,
      notificationProduct: true,
      developerFocus: "",
      experienceLevel: "",
      goals: [],
      portfolioUrl: "",
      availability: "",
      companySize: "",
      hiringStage: "",
      hiringFocus: "",
      companyMemberRole: "",
      companyFirstAction: "",
      expertiseAreas: [],
      experienceEvidence: "",
    }
  );
  const [skipPortfolio, setSkipPortfolio] = useState(
    progress?.skippedFields.includes("portfolio_url") ?? false
  );
  const [stepIndex, setStepIndex] = useState(() =>
    getResumeStepIndex(role, progress?.draft ?? draft, Boolean(progress))
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [returnAfterSave, setReturnAfterSave] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const action =
    role === "reviewer"
      ? saveReviewerOnboardingAction
      : saveActiveOnboardingAction;
  const [actionState, formAction] = useActionState(
    action,
    initialOnboardingActionState
  );
  const step = steps[stepIndex] ?? reviewStep;
  const isFinal = step.key === "review";
  const complete =
    progress?.state === "completed" || progress?.state === "needs_review";

  useEffect(() => {
    if (returnAfterSave && actionState.status === "success") {
      router.push("/auth/continue");
    }
  }, [actionState.status, returnAfterSave, router]);

  const visibleErrors = actionState.fieldErrors ?? clientErrors;

  const update = <Key extends keyof OnboardingDraft>(
    key: Key,
    value: OnboardingDraft[Key]
  ) => {
    setDraft(current => ({ ...current, [key]: value }));
    setClientErrors(current => {
      const remaining = { ...current };
      delete remaining[key];
      return remaining;
    });
  };

  const submit = (intent: "save" | "complete", returnToContext = false) => {
    const errors = validateOnboardingStep(draft, role, step.key);
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    const formData = new FormData(formRef.current ?? undefined);
    formData.set("draft", JSON.stringify(draft));
    formData.set("skipPortfolio", String(skipPortfolio));
    formData.set("step", step.key);
    formData.set("intent", intent);
    setReturnAfterSave(returnToContext);
    startTransition(() => formAction(formData));
    if (intent === "save")
      setStepIndex(index => Math.min(index + 1, steps.length - 1));
  };

  if (complete) {
    const item =
      role === "company_member" && draft.companyFirstAction === "create_project"
        ? {
            title: "Prepare a future project brief",
            body: "Your organization membership is explicit. Project creation is not enabled in this onboarding phase, so no project has been created yet.",
            next: "Return to account context",
          }
        : role === "company_member" &&
            draft.companyFirstAction === "discover_talent"
          ? {
              title: "Prepare evidence-led discovery",
              body: "Your organization context is ready. Talent discovery is not enabled in this onboarding phase, so no search or contact action has been started.",
              next: "Return to account context",
            }
          : role === "talent" && draft.goals.includes("get_feedback")
            ? {
                title: "Prepare for useful feedback",
                body: "Your onboarding details are private. When a bounded proof path is enabled, return here to choose work you can explain and receive human feedback on.",
                next: "Return to account context",
              }
            : recommendation[role];
    return (
      <section
        className="onboarding-complete"
        aria-labelledby="onboarding-complete-title"
      >
        <p
          className="onboarding-state"
          data-state={progress?.state}
          role="status"
        >
          {progress?.state === "needs_review" ||
          reviewerRequestStatus === "pending"
            ? "Needs review"
            : "Completed"}
        </p>
        <h2 id="onboarding-complete-title">{item.title}</h2>
        <p>{item.body}</p>
        <a className="button button-primary" href="/auth/continue">
          {item.next}
        </a>
      </section>
    );
  }

  return (
    <form
      className="onboarding-form"
      ref={formRef}
      onSubmit={event => event.preventDefault()}
    >
      <div
        className="onboarding-progress"
        aria-label={`${roleLabels[role]} onboarding progress`}
      >
        <p>
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol>
          {steps.map((item, index) => (
            <li
              key={item.key}
              data-current={index === stepIndex}
              data-complete={index < stepIndex}
            >
              <span aria-hidden="true">
                {index < stepIndex ? "✓" : index + 1}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="auth-card-header onboarding-step-title">
        <h2>{step.label}</h2>
        <p>{step.reason}</p>
      </div>
      {actionState.status !== "idle" && actionState.message ? (
        <p
          className="auth-status"
          data-status={actionState.status}
          role={actionState.status === "error" ? "alert" : "status"}
        >
          {actionState.message}
        </p>
      ) : null}

      {step.key === "identity" ? (
        <>
          <div className="auth-field">
            <label htmlFor="fullName">Your name</label>
            <input
              id="fullName"
              value={draft.fullName}
              onChange={event => update("fullName", event.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(visibleErrors.fullName)}
              aria-describedby={
                visibleErrors.fullName ? "fullName-error" : "fullName-hint"
              }
            />
            <p className="auth-field-hint" id="fullName-hint">
              Used privately for account context. It is not a public proof or
              profile.
            </p>
            {visibleErrors.fullName ? (
              <p className="auth-field-error" id="fullName-error" role="alert">
                {visibleErrors.fullName}
              </p>
            ) : null}
          </div>
          <div className="auth-field">
            <label htmlFor="displayName">Preferred display name</label>
            <input
              id="displayName"
              value={draft.displayName}
              onChange={event => update("displayName", event.target.value)}
              autoComplete="nickname"
              aria-invalid={Boolean(visibleErrors.displayName)}
              aria-describedby={
                visibleErrors.displayName
                  ? "displayName-error"
                  : "displayName-hint"
              }
            />
            <p className="auth-field-hint" id="displayName-hint">
              You can change this later, before any future public visibility
              choice.
            </p>
            {visibleErrors.displayName ? (
              <p
                className="auth-field-error"
                id="displayName-error"
                role="alert"
              >
                {visibleErrors.displayName}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step.key === "purpose" ? (
        <>
          <SelectField
            id="primaryPurpose"
            label="Primary purpose"
            value={draft.primaryPurpose}
            onChange={value => update("primaryPurpose", value)}
            error={visibleErrors.primaryPurpose}
            hint="This only orients the next action. It does not decide access, review, or opportunity."
            options={
              role === "talent"
                ? [
                    { value: "build_proof", label: "Build work I can explain" },
                    {
                      value: "get_feedback",
                      label: "Prepare for useful feedback",
                    },
                  ]
                : role === "company_member"
                  ? [
                      {
                        value: "prepare_team",
                        label: "Prepare an evidence-led team context",
                      },
                      {
                        value: "understand_evidence",
                        label: "Understand the evidence path",
                      },
                    ]
                  : [
                      {
                        value: "prepare_reviewer_request",
                        label: "Prepare a reviewer request",
                      },
                      {
                        value: "understand_reviewer_responsibility",
                        label: "Understand reviewer responsibility",
                      },
                    ]
            }
          />
          <SelectField
            id="timezone"
            label="Timezone"
            value={draft.timezone}
            onChange={value => update("timezone", value)}
            error={visibleErrors.timezone}
            hint="Used only to present future schedules and deadlines clearly."
            options={[
              { value: "UTC", label: "UTC" },
              { value: "Asia/Dhaka", label: "Asia/Dhaka" },
              { value: "Asia/Kolkata", label: "Asia/Kolkata" },
              { value: "America/New_York", label: "America/New York" },
              { value: "America/Los_Angeles", label: "America/Los Angeles" },
              { value: "Europe/London", label: "Europe/London" },
              { value: "Europe/Berlin", label: "Europe/Berlin" },
            ]}
          />
        </>
      ) : null}

      {step.key === "notifications" ? (
        <fieldset className="onboarding-check-group">
          <legend>Notification defaults</legend>
          <p className="auth-field-hint">
            Choose a starting preference. You can change these later before any
            delivery is enabled.
          </p>
          <label className="onboarding-check">
            <input
              type="checkbox"
              checked={draft.notificationEmail}
              onChange={event =>
                update("notificationEmail", event.target.checked)
              }
            />
            <span>Account and security updates by email</span>
          </label>
          <label className="onboarding-check">
            <input
              type="checkbox"
              checked={draft.notificationProduct}
              onChange={event =>
                update("notificationProduct", event.target.checked)
              }
            />
            <span>Product progress updates when relevant</span>
          </label>
        </fieldset>
      ) : null}

      {step.key === "role" && role === "talent" ? (
        <>
          <SelectField
            id="developerFocus"
            label="Developer focus"
            value={draft.developerFocus}
            onChange={value => update("developerFocus", value)}
            error={visibleErrors.developerFocus}
            hint="Use this to orient the type of work you may explore later."
            options={[
              { value: "frontend", label: "Frontend" },
              { value: "backend", label: "Backend" },
              { value: "full_stack", label: "Full-stack" },
              { value: "product_engineering", label: "Product engineering" },
            ]}
          />
          <SelectField
            id="experienceLevel"
            label="Current experience level"
            value={draft.experienceLevel}
            onChange={value => update("experienceLevel", value)}
            error={visibleErrors.experienceLevel}
            hint="This is your private self-description, not a verified skill level."
            options={[
              { value: "learning", label: "Learning and building" },
              { value: "early_career", label: "Early career" },
              {
                value: "career_transition",
                label: "Changing into software work",
              },
            ]}
          />
          <CheckGroup
            label="What do you want to do first?"
            selected={draft.goals}
            onChange={values =>
              update("goals", values as OnboardingDraft["goals"])
            }
            error={visibleErrors.goals}
            options={talentGoals.map(value => ({
              value,
              label:
                value === "prove_skills"
                  ? "Prove specific skills"
                  : value === "find_projects"
                    ? "Find relevant projects"
                    : value === "get_feedback"
                      ? "Get useful feedback"
                      : "Find work when available",
            }))}
          />
          <div className="auth-field">
            <label htmlFor="portfolioUrl">
              Portfolio or GitHub link{" "}
              <span className="onboarding-optional">Optional</span>
            </label>
            <input
              id="portfolioUrl"
              value={draft.portfolioUrl}
              onChange={event => update("portfolioUrl", event.target.value)}
              inputMode="url"
              placeholder="https://"
              aria-invalid={Boolean(visibleErrors.portfolioUrl)}
              aria-describedby={
                visibleErrors.portfolioUrl
                  ? "portfolioUrl-error"
                  : "portfolioUrl-hint"
              }
            />
            <p className="auth-field-hint" id="portfolioUrl-hint">
              A link is context only. It is not verified proof and is private
              until a future visibility choice.
            </p>
            {visibleErrors.portfolioUrl ? (
              <p
                className="auth-field-error"
                id="portfolioUrl-error"
                role="alert"
              >
                {visibleErrors.portfolioUrl}
              </p>
            ) : null}
            <label className="onboarding-check">
              <input
                type="checkbox"
                checked={skipPortfolio}
                onChange={event => setSkipPortfolio(event.target.checked)}
              />
              <span>Skip this for now</span>
            </label>
          </div>
          <SelectField
            id="availability"
            label="Availability"
            value={draft.availability}
            onChange={value => update("availability", value)}
            error={visibleErrors.availability}
            hint="Used only to orient a future proof path, not to decide opportunity access."
            options={[
              { value: "exploring", label: "Exploring a proof path" },
              { value: "part_time", label: "Available part-time" },
              { value: "full_time", label: "Available full-time" },
            ]}
          />
        </>
      ) : null}

      {step.key === "role" && role === "company_member" ? (
        <>
          <SelectField
            id="companySize"
            label="Company size"
            value={draft.companySize}
            onChange={value => update("companySize", value)}
            error={visibleErrors.companySize}
            hint="A private planning input for this organization context."
            options={[
              { value: "1_10", label: "1–10 people" },
              { value: "11_50", label: "11–50 people" },
              { value: "51_200", label: "51–200 people" },
            ]}
          />
          <SelectField
            id="hiringStage"
            label="Hiring stage"
            value={draft.hiringStage}
            onChange={value => update("hiringStage", value)}
            error={visibleErrors.hiringStage}
            hint="This does not publish a role or start a hiring workflow."
            options={[
              { value: "planning", label: "Planning" },
              { value: "exploring", label: "Exploring evidence" },
              { value: "preparing", label: "Preparing a future project" },
            ]}
          />
          <SelectField
            id="hiringFocus"
            label="Hiring focus"
            value={draft.hiringFocus}
            onChange={value => update("hiringFocus", value)}
            error={visibleErrors.hiringFocus}
            hint="Used only for orientation; it does not rank or contact talent."
            options={[
              { value: "frontend", label: "Frontend" },
              { value: "backend", label: "Backend" },
              { value: "full_stack", label: "Full-stack" },
              { value: "product_engineering", label: "Product engineering" },
            ]}
          />
          <SelectField
            id="companyMemberRole"
            label="Your first company member role"
            value={draft.companyMemberRole}
            onChange={value =>
              update(
                "companyMemberRole",
                value as OnboardingDraft["companyMemberRole"]
              )
            }
            error={visibleErrors.companyMemberRole}
            hint="Your initial owner permission is retained; this records the role you expect to use first."
            options={companyMemberRoles.map(value => ({
              value,
              label: value.replaceAll("_", " "),
            }))}
          />
          <SelectField
            id="companyFirstAction"
            label="First action preference"
            value={draft.companyFirstAction}
            onChange={value => update("companyFirstAction", value)}
            error={visibleErrors.companyFirstAction}
            hint="No project or discovery action will be created in this phase."
            options={[
              {
                value: "create_project",
                label: "Create a project when available",
              },
              {
                value: "discover_talent",
                label: "Discover talent when available",
              },
            ]}
          />
        </>
      ) : null}

      {step.key === "role" && role === "reviewer" ? (
        <>
          <section
            className="onboarding-responsibility"
            aria-labelledby="reviewer-responsibility-title"
          >
            <p className="onboarding-state" data-state="pending">
              Reviewer responsibility
            </p>
            <h3 id="reviewer-responsibility-title">
              Human judgment stays accountable.
            </h3>
            <p>
              Reviewer approval is not automatic. A request records your
              preparation for qualified human review; it does not grant review
              access or allow self-review.
            </p>
          </section>
          <CheckGroup
            label="Areas you can review"
            selected={draft.expertiseAreas}
            onChange={values =>
              update(
                "expertiseAreas",
                values as OnboardingDraft["expertiseAreas"]
              )
            }
            error={visibleErrors.expertiseAreas}
            options={reviewerExpertiseAreas.map(value => ({
              value,
              label:
                value === "full_stack"
                  ? "Full-stack"
                  : value === "product_engineering"
                    ? "Product engineering"
                    : value[0]!.toUpperCase() + value.slice(1),
            }))}
          />
          <div className="auth-field">
            <label htmlFor="experienceEvidence">Experience evidence</label>
            <textarea
              id="experienceEvidence"
              value={draft.experienceEvidence}
              onChange={event =>
                update("experienceEvidence", event.target.value)
              }
              maxLength={500}
              aria-invalid={Boolean(visibleErrors.experienceEvidence)}
              aria-describedby={
                visibleErrors.experienceEvidence
                  ? "experienceEvidence-error"
                  : "experienceEvidence-hint"
              }
            />
            <p className="auth-field-hint" id="experienceEvidence-hint">
              Briefly describe relevant experience for a human reviewer. This is
              private to the approval path and does not become public proof.
            </p>
            {visibleErrors.experienceEvidence ? (
              <p
                className="auth-field-error"
                id="experienceEvidence-error"
                role="alert"
              >
                {visibleErrors.experienceEvidence}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {step.key === "review" ? (
        <section
          className="onboarding-review"
          aria-labelledby="onboarding-review-title"
        >
          <p className="onboarding-state" data-state="private">
            Private by default
          </p>
          <h3 id="onboarding-review-title">Review your onboarding details</h3>
          <dl>
            <div>
              <dt>Display name</dt>
              <dd>{draft.displayName || "Not set"}</dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>{draft.primaryPurpose.replaceAll("_", " ") || "Not set"}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{draft.timezone || "Not set"}</dd>
            </div>
            <div>
              <dt>Notifications</dt>
              <dd>
                {draft.notificationEmail || draft.notificationProduct
                  ? "Selected defaults"
                  : "No optional updates"}
              </dd>
            </div>
            <div>
              <dt>
                {role === "talent"
                  ? "Focus"
                  : role === "company_member"
                    ? "Hiring focus"
                    : "Expertise"}
              </dt>
              <dd>
                {role === "talent"
                  ? draft.developerFocus || "Not set"
                  : role === "company_member"
                    ? draft.hiringFocus || "Not set"
                    : draft.expertiseAreas.join(", ") || "Not set"}
              </dd>
            </div>
          </dl>
          <ul
            className="onboarding-completion-checklist"
            aria-label="Completion checklist"
          >
            <li>
              <span aria-hidden="true">✓</span> Private account details
              confirmed
            </li>
            <li>
              <span aria-hidden="true">✓</span> Timezone and notification
              defaults selected
            </li>
            <li>
              <span aria-hidden="true">✓</span>{" "}
              {role === "reviewer"
                ? "Reviewer request preparation reviewed"
                : "Role-specific first action prepared"}
            </li>
          </ul>
          <p>
            This does not publish a profile, create a project, assign a review,
            or make a decision about your eligibility.
          </p>
        </section>
      ) : null}

      <div className="onboarding-actions">
        {stepIndex > 0 ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setStepIndex(index => index - 1)}
            disabled={isPending}
          >
            Back
          </button>
        ) : null}
        <button
          className="button button-primary"
          type="button"
          onClick={() => submit(isFinal ? "complete" : "save")}
          disabled={isPending}
        >
          {isPending
            ? "Saving…"
            : isFinal
              ? role === "reviewer"
                ? "Request reviewer approval"
                : "Complete onboarding"
              : "Save and continue"}
        </button>
      </div>
      {!isFinal ? (
        <button
          className="onboarding-return-later"
          type="button"
          onClick={() => submit("save", true)}
          disabled={isPending}
        >
          Save and return later
        </button>
      ) : null}
      <p className="onboarding-save-note" role="status">
        Valid progress is saved privately when you continue. You can return
        later without losing it.
      </p>
    </form>
  );
}
