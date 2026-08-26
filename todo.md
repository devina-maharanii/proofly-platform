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

### Phase 19 post-release environment activation

- [x] Confirm the user has bulk-saved all four managed Edge Function secrets without exposing their values.
- [ ] Verify the deployed OAuth callback configuration and authenticated consent-start boundary, then report the remaining user-session connection test.

## Phase 20 — Public Proof Profile

- [x] Read the Phase 20 attachments, Phases 17–19 public foundations, design system, public/profile/data/security/API/event contracts, and all applicable Proofly source-of-truth documents.
- [x] Define the stable `/talent/[handle]` handle, visibility, public-state, verified-proof, GitHub-context, contact-action, share-link, metadata, canonical, sitemap, and noindex contract without search, messaging, ranking, or hiring workflow scope.
- [x] Implement only the approved stable public route/renderer, truthful identity/evidence/proof/GitHub context, limited/hidden/draft/not-found states, share/copy link, primary company action boundary, and SEO presentation.
- [x] Add visibility, privacy, proof-state, metadata, canonical/noindex, sharing, accessibility, keyboard, mobile, formatting, lint, strict TypeScript, test, build, security, and final diff validation.
- [x] Classify the local public-route loading-shell observation: it also reproduces on the existing Phase 18 evidence unavailable route; deterministic server-response and production-build checks validate Phase 20’s unavailable response instead.
- [x] Commit and push exactly one Phase 20 commit on `main`.

## Phase 21 — Company Profile

- [x] Read the Phase 21 attachments, Phases 12/14/15/20 foundations, design system, company/domain/data/security/API/event contracts, and relevant project guidance.
- [x] Define the approved organization-owned company profile, authority, member attribution, proposal, public visibility, stable-handle, lifecycle, metadata, and noindex contract without projects, search, hiring, billing, or private-workspace administration.
- [x] Implement only the company data model, editor, modular preview, authorized owner/member actions, attribution controls, draft/ready/publish/hide lifecycle, public route, and public company renderer.
- [x] Add authorization, RLS, attribution-history, privacy, lifecycle, validation, public metadata, keyboard, mobile, formatting, lint, strict TypeScript, browser, build, security, and final diff validation.
- [x] Commit and push exactly one Phase 21 commit on `main`.

## Phase 22 — Project Creation

- [x] Read the Phase 22 attachments, Phases 04/12/15/16/21 foundations, design system, project/domain/data/security/API/event contracts, and applicable project guidance.
- [x] Define organization-owned Project/Challenge types, required fields, canonical taxonomy selection, private/public or invitation visibility, stable route, lifecycle, state transitions, authorization, audit, and fairness contract without discovery, applications, messaging, payments, reviewer queues, or contracts.
- [x] Implement only authorized project draft persistence, modular creation/editor flow, actual preview, skill selector, deliverables, evaluation configuration, opportunity/fairness disclosure, ethical validation, publishing, pausing, closing, archiving, and public/invitation rendering.
- [x] Add authorization, RLS, attachment-access, privacy, taxonomy, lifecycle, timebox, protected-characteristic, compensation/IP, response-expectation, metadata, keyboard, mobile, formatting, lint, strict TypeScript, browser, build, security, and final diff validation.
- [x] Commit and push exactly one Phase 22 commit on `main`.

## Phase 23 — Project Discovery and Search

- [x] Read the Phase 23 attachments, Phases 16/21/22 foundations, master guide, and all relevant product, data, security, API/event, design, accessibility, and test contracts.
- [x] Define deterministic public-project search, URL filters, transparent result explanations, visibility boundaries, saved-project ownership, recent-search privacy, index/query strategy, and clear Phase 23 exclusions.
- [x] Implement only project discovery index, search/filter controls, scannable detail, saved-project behavior, URL state, loading/empty/error states, and permission-safe public or authorized visibility handling.
- [x] Add and run discovery, RLS, search/index, fairness, URL, saved-project, accessibility, mobile, regression, formatting, lint, strict TypeScript, browser, build, security, and final diff validation.
- [x] Commit and push exactly one Phase 23 commit on `main`.
