# Phase 10 Work Items

- [x] Inspect the existing public homepage, source documents, and release constraints.
- [x] Harden route metadata, sitemap, robots, semantic landmarks, skip navigation, focus behavior, and media semantics.
- [x] Document the public SEO, accessibility, responsive, performance, ownership, and release-gate contracts.
- [x] Resolve and validate persisted light/dark theme control behavior across hydration.
- [x] Validate keyboard access, reduced motion, responsive viewports, performance budget, build, tests, and complete diff.
- [x] Commit and push exactly one Phase 10 commit on `main`.

## Phase 11 — Login and Registration

- [x] Read the Phase 11 attachments, source-of-truth documents, current application architecture, and Supabase full-stack guidance.
- [x] Establish secure Supabase Auth server/client helpers, session refresh, safe callbacks, and protected boundaries without exposing privileged credentials.
- [x] Build only role-neutral registration, login, verification, recovery, reset, logout, and supported OAuth states with accessible feedback.
- [x] Add deterministic authentication/security fixtures and tests for validation, rate limiting, redirect allowlisting, session recovery, and protected access.
- [x] Run formatting, lint, strict TypeScript, authentication/security tests, browser checks, production build, and complete diff review.
- [x] Commit and push exactly one Phase 11 commit on `main`.

## Phase 12 — User Roles

- [x] Read the Phase 12 attachments, required source-of-truth documents, current authentication implementation, and Supabase full-stack guidance.
- [x] Define and migrate only the approved role capabilities, organization memberships, permission matrix, active context, server authorization, and RLS boundaries.
- [x] Implement role-aware navigation, organization switching, capability-request onboarding handoff, and safe permission responses without building role dashboards.
- [x] Add authorization/RLS fixtures and tests for all Phase 12 scenarios, then run formatting, lint, strict TypeScript, browser checks, production build, and complete diff review.
- [x] Commit and push exactly one Phase 12 commit on `main`.

## Phase 13 — Onboarding Flow

- [x] Read the Phase 13 attachments, Phase 11 and 12 foundations, and all applicable Proofly source-of-truth documents.
- [x] Define and migrate only the approved common and role-specific onboarding state, secure draft persistence, privacy-safe events, and RLS boundaries.
- [x] Implement authenticated progressive Talent, Company, and Reviewer onboarding with validation, resume/skip behavior, completion checklist, and first-action handoff.
- [x] Add onboarding, authorization, privacy, accessibility, responsive, formatting, lint, strict TypeScript, test, build, and final diff validation.
- [x] Commit and push exactly one Phase 13 commit on `main`.

## Phase 14 — Account Settings

- [x] Read the Phase 14 attachments, Phase 11 through 13 foundations, and all applicable Proofly source-of-truth documents.
- [x] Define and migrate only the approved personal-settings, privacy, notification, connected-account, session, data-rights, sensitive-event, and RLS boundaries.
- [x] Implement authenticated personal settings navigation and forms with validated save/reset, recent-auth safeguards, explicit session and connected-account controls, and request-based export/deletion flows.
- [x] Add privacy, authorization, sensitive-action, accessibility, responsive, regression, formatting, lint, strict TypeScript, test, build, and final diff validation.
- [x] Commit and push exactly one Phase 14 commit on `main`.

## Phase 15 — Permissions and Security

- [x] Read the Phase 15 attachments, Phase 11, 12, and 14 foundations, and all applicable Proofly source-of-truth documents.
- [x] Define the approved permission matrix, RLS and storage policy map, server authorization contract, rate-limit map, audit catalog, threat priorities, and security test matrix.
- [x] Implement only approved defense-in-depth server authorization, rate limits, file-access safeguards, audit boundaries, RLS hardening, and CI security checks.
- [x] Add adversarial authorization, RLS, storage, rate-limit, privacy, security, accessibility, formatting, lint, strict TypeScript, test, build, and final diff validation.
- [x] Commit and push exactly one Phase 15 commit on `main`.

## Phase 16 — Skill Taxonomy

- [x] Read the Phase 16 attachments, Phases 04 and 15 foundations, and all applicable Proofly source-of-truth documents.
- [x] Define only the approved versioned software skill entities, families, levels, evidence vocabulary, relationships, and governed change lifecycle.
- [x] Reconcile only `DOMAIN_MODEL.md`, `MASTER_PRD.md`, and `TECHNICAL_ARCHITECTURE.md` without building profiles, AI extraction, opaque scoring, schema, or product features.
- [x] Verify all acceptance and scenario criteria, documentation consistency, complete diff scope, and the required commit state.
- [x] Commit and push exactly one Phase 16 commit on `main`.

## Phase 17 — Talent Profile

- [x] Read the Phase 17 attachments, Phases 12, 14, 15, and 16 foundations, the design system, and all applicable Proofly source-of-truth documents.
- [x] Establish the approved secure profile persistence capability and define only the talent-profile model, owner-only draft writes, publish/hide lifecycle, visibility contract, canonical claimed skills, and completion guidance.
- [x] Implement only the authenticated talent profile editor, public preview, draft/publish/hide actions, field visibility controls, validation, empty/saved/error states, and evidence-ready profile references.
- [x] Add ownership, RLS, privacy, validation, lifecycle, accessibility, mobile, regression, formatting, lint, strict TypeScript, test, build, and final diff validation without GitHub sync, submissions, verification, scoring, or company profiles.
- [x] Commit and push exactly one Phase 17 commit on `main`.

## Phase 18 — Portfolio and Work Evidence

- [x] Read the Phase 18 attachments, Phases 16 and 17 foundations, the security and data contracts, and all applicable Proofly source-of-truth documents.
- [x] Define only the approved manual work-evidence model, types, attribution and ownership disclosures, version-aware lifecycle, visibility, privacy, and public-snapshot contract.
- [x] Implement only Talent-owned evidence create/edit/preview/publish/hide/archive flows, evidence detail, public profile list, state labels, fallback states, and structured integrity prompts.
- [x] Add ownership, RLS, attribution, privacy, lifecycle, validation, accessibility, mobile, regression, formatting, lint, strict TypeScript, test, build, and final diff validation without GitHub sync, plagiarism detection, rubrics, or verified reputation.
- [x] Commit and push exactly one Phase 18 commit on `main`.

## Phase 19 — GitHub Integration

- [x] Read the Phase 19 attachments, Phases 15, 17, and 18 foundations, GitHub’s current official provider guidance, the security and data contracts, and all applicable Proofly source-of-truth documents.
- [x] Define only the narrow GitHub consent, OAuth state/callback, server-only token, normalized snapshot, repository selection, privacy, sync, rate-limit, partial-failure, idempotency, and revocation contract.
- [x] Implement only optional Talent GitHub linking, selected public context, initial/manual synchronization, status/error states, disconnect/data deletion, and source/timestamp presentation without private-repository access, write permissions, proof verification, scores, employer inference, or webhooks.
- [x] Add consent, authorization, token-boundary, callback-state, privacy, sync, stale-data, rate-limit, failure, idempotency, accessibility, formatting, lint, strict TypeScript, test, build, security, and final diff validation.
- [x] Commit and push exactly one Phase 19 commit on `main`.
