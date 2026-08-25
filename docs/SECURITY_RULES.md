# Security Rules

## Phase 15 enforcement model

Proofly applies defense in depth. A protected action must pass route protection, a verified server session, an exact server-side policy decision, domain-state checks, Row-Level Security, and—when a file is involved—private-storage authorization before it can proceed. Client state may improve presentation, but it never establishes identity, role, organization, ownership, visibility, workflow state, or administrative access.

## Permission matrix

| Capability                    | Server decision                                                                      | Database boundary                                        | Explicit denial                                             |
| ----------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| Read a personal resource      | Authenticated owner, explicit participant, or approved visibility                    | Owner/participant RLS policy                             | Other users cannot infer private existence                  |
| Read an organization resource | Active organization membership and matching organization scope                       | Active-membership RLS policy                             | A changed organization ID returns `NOT_FOUND_OR_PRIVATE`    |
| Edit a resource               | Owner or exact organization command permission in active matching context            | Command-only mutation RPC; no direct client write policy | Viewer, removed member, and cross-tenant member             |
| Publish a resource            | Owner or authorized organization command after domain visibility/state checks        | Resource-specific server command and RLS                 | Client-selected public visibility                           |
| Review a submission           | Approved reviewer context, valid assignment state, and no self/conflict relationship | Reviewer/assignment RLS when the module exists           | Self-review, conflicted review, or unassigned reviewer      |
| Manage organization           | Active matching company context with `owner`                                         | Membership-controlled organization RLS                   | Client role claim or another organization                   |
| Manage billing                | Active matching company context with `owner` or `billing_member`                     | Billing-specific RLS when implemented                    | Viewer, hiring, or reviewer membership                      |
| Moderate or administer        | Explicit verified `administrator` capability, controlled operational path, and audit | No ordinary-user admin policy                            | Self-assignment, active-context selection, or client bypass |

## Current RLS map

All current `public` tables have RLS enabled. Existing Phase 12–14 records are read through owner or active-membership `SELECT` policies; direct client mutation policies are intentionally absent. Write paths use narrowly allowlisted, authenticated self-service functions that derive the actor from `auth.uid()` and validate only approved payload fields. The controlled administrator-grant function remains unavailable to ordinary signed-in callers.

| Data group                    | Current tables                                                                                                                     | Access rule                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Role and organization context | `organizations`, `organization_memberships`, `role_capabilities`, `capability_requests`, `active_contexts`, `authorization_events` | Own capability/context/event, or active own membership; membership-dependent organization visibility |
| Onboarding                    | `onboarding_progress`, `onboarding_events`                                                                                         | Private to actor; server-controlled self-service transition functions                                |
| Personal account              | `personal_settings`, `data_rights_requests`, `account_security_events`                                                             | Private to actor; allowlisted self-service RPCs and append-only event records                        |

There are no project, submission, review, proof, payment, messaging, storage-object, or admin-domain records in the released schema. Phase 15 does not fabricate them. Before any such module is introduced, its migration must add RLS, an explicit policy map, ownership/organization/visibility fields, and adversarial policy tests in the same approved phase.

## Server authorization contract

Every server action and route handler follows this sequence: authenticate with the request-scoped Supabase session; validate bounded input; load resource facts from server-owned data; evaluate one responsibility-specific policy helper; validate organization membership, ownership, visibility, workflow state, and conflict status; execute a scoped command; record the minimal audit event; and return a safe typed result. Authorization failures that could disclose a private resource use `NOT_FOUND_OR_PRIVATE`; no branch reflects whether the resource exists, was removed, or belongs to another organization.

`canAccessResource`, `canEditResource`, `canPublishResource`, `canReviewSubmission`, `canManageOrganization`, `canManageBilling`, `canModerateContent`, and `canPerformAdminAction` are pure policies. Server code supplies their actor and resource facts from verified session/context and authorized data reads, never from client role, organization, owner, or admin fields.

## File-access contract

Files remain unimplemented in the current schema. The contract is therefore fail-closed: no public bucket, direct object URL, or browser-provided object key is accepted. A future upload must use a private bucket, a server-validated content type and size, an ownership-bound safe object key, scan/quarantine state, and a short-lived signed URL issued only after the same server authorization decision used for the source resource. A revoked membership or visibility decision invalidates future signing; an already issued URL expires without renewal. Private-file denial returns the same `NOT_FOUND_OR_PRIVATE` response.

## Rate-limit map

| Boundary                       | Keying and policy intent                 | Current enforcement                                            |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------- |
| Authentication and recovery    | Hashed identity plus request address     | Phase 11 server actions                                        |
| Sensitive account mutations    | Verified actor plus request address      | Password, session, connection, export, and deletion actions    |
| General mutation commands      | Verified actor plus request address      | Shared server-side policy for approved mutating modules        |
| Search, messaging, and uploads | Verified actor plus request address      | Contract is fail-closed until the feature boundary exists      |
| Webhooks                       | Provider event ID and bounded source key | Signature and replay contract; no provider endpoint exists yet |

The in-process limiter is a development and single-instance guard. Production rollout requires a durable shared counter or provider-native control before horizontally scaled endpoints rely on rate limits.

## Audit event catalog

Audit records are append-only, actor-derived, and contain an allowlisted action name and timestamp only. They must not store secrets, raw provider events, passwords, tokens, private file contents, identity documents, or unrestricted request payloads. Current catalogues are `authorization.*`, `onboarding.*`, and `account.*`; future `admin.*`, `file.*`, `webhook.*`, `proof.*`, and `payment.*` events require the source module, resource reference, privacy class, retention rule, and replay/idempotency boundary before implementation.

## Threat priorities and security tests

The highest priorities are account takeover, cross-organization leakage, removed-member access, administrator escalation, private-file leakage, webhook replay/signature forgery, malicious uploads, and disclosure through error messages. Phase 15 tests mutate client-supplied user and organization values, exercise owner/membership/role conflicts, deny removed member access, validate storage metadata, reject replay and invalid webhook signatures, assert rate-limit exhaustion, inspect RLS and function grants, and check that client bundles do not reference privileged credentials.
