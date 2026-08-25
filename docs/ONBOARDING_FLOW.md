# Phase 13 Onboarding Flow

## Purpose and boundary

Phase 13 gives an authenticated person a **private, progressive orientation** to the active Talent or Company context, or to a Reviewer approval request. It persists only the information needed to make a truthful first-action recommendation. It does not create a public profile, marketplace project, talent search, reviewer assignment, review outcome, payment, billing record, AI decision, or administrator workflow.

## Server-derived target

The onboarding route is protected by the same verified-session boundary as the account-context route. Talent and Company onboarding derive the user, role, and organization exclusively from the server-side Phase 12 active context. A client-submitted user ID, capability, organization ID, or permission is never an authorization input. Reviewer preparation is available to an authenticated person before approval, but it does not establish a Reviewer active context or reviewer access.

| Flow | Persisted state | Completion outcome | First-action handoff |
|---|---|---|---|
| Talent | Private common preferences plus developer focus, self-described experience level, goals, optional link, and availability | `completed` | A specific proof-path orientation, without creating a project or application |
| Company | A private organization, active owner membership, common preferences, and company planning inputs | `completed` | A future-project or future-discovery orientation, without creating a project, search, or billing record |
| Reviewer | Private common preferences, expertise areas, and experience evidence | `needs_review` plus a pending reviewer capability request | A qualified-human-review notice; no reviewer queue, assignment, or self-approval |

## Progress and recovery

Onboarding records are keyed by authenticated person, role, and organization context. Common and role-specific steps are saved through validated server actions, so a refresh, device change, or later authenticated session can resume the latest accepted draft. The portfolio/GitHub link is optional and can be skipped. The explicit **Save and return later** action first saves validated progress, then returns the person to account context.

The state vocabulary is `not_started`, `in_progress`, `ready_for_workspace`, `needs_review`, and `completed`. The UI presents a five-step progress rail, a review checkpoint, and a completion checklist. Values are private by default and are not published or reused as evidence of skill, reviewer qualification, eligibility, or organizational verification.

## Persistence, events, and access control

`onboarding_progress` holds only the whitelisted draft values and skipped-field marker, while `onboarding_events` stores a fixed event type and optional structural step key. Event rows deliberately contain no free-form metadata or private draft values. The schema limits serialized draft size, rejects unknown reviewer draft keys, enables RLS on both tables, and exposes only the owner’s private reads.

All writes run through narrowly scoped `SECURITY DEFINER` RPCs that derive the actor from `auth.uid()`. Anonymous callers have no execute privilege. Authenticated self-service functions revalidate the person’s current active Talent or Company context and active organization membership before updating draft state. The reviewer completion function records a pending request but does not write a `role_capabilities` row; an independent controlled approval path remains required.
