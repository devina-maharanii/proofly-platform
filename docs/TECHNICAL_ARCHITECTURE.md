# Proofly Technical Architecture

## Architecture decision

This document is the implementation architecture for Proofly's approved first-release domain model. It is a blueprint for incremental work, not feature code or proof that a runtime is already deployed.

**[Decision]** Start with a **modular monolith**. Keep module ownership explicit inside one Next.js application and extract a service only when a measured scale, security, compliance, or operational boundary justifies the cost. A small team should be able to implement and test one module at a time without inventing a second architecture.

**[Mandatory runtime]** The application runtime is the latest stable compatible **Next.js App Router** with strict TypeScript, React Server Components by default, and server actions or route handlers for mutations. **Vite is not the application runtime. Express is not the primary application runtime.** Tailwind CSS and owned shadcn/ui components using Radix primitives are the approved UI foundations for later phases; this phase creates no UI. No production database tables, migrations, or feature code are created in Phase 05.

The architecture aligns with [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md), [`DATA_MODEL_CONTRACT.md`](https://github.com/devina-maharanii/proofly-platform/blob/main/docs/DATA_MODEL_CONTRACT.md), [`API_EVENT_CONTRACT.md`](https://github.com/devina-maharanii/proofly-platform/blob/main/docs/API_EVENT_CONTRACT.md), [`SECURITY_RULES.md`](https://github.com/devina-maharanii/proofly-platform/blob/main/docs/SECURITY_RULES.md), [`AI_GOVERNANCE.md`](https://github.com/devina-maharanii/proofly-platform/blob/main/docs/AI_GOVERNANCE.md), and [`DEPLOYMENT_OPERATIONS.md`](https://github.com/devina-maharanii/proofly-platform/blob/main/docs/DEPLOYMENT_OPERATIONS.md).

## Required technology baseline

| Concern | Approved architecture | Boundary or reason |
|---|---|---|
| Web runtime | Next.js App Router on current supported Node.js LTS | Route handlers, server actions, layouts, and React Server Components are the application runtime. No Vite or Express primary runtime. |
| Language | TypeScript strict mode | Domain commands, adapters, events, jobs, and UI contracts are typed at boundaries. |
| UI | React Server Components by default; Tailwind CSS; owned shadcn/ui components with Radix primitives | Client components are opt-in for interaction and cannot own cross-domain business rules. |
| Authentication | Supabase Auth with `@supabase/ssr` server/client patterns | Browser code receives only the publishable/anonymous key; session and authorization checks remain server-side. |
| Database | Supabase PostgreSQL with Row-Level Security on every table | PostgreSQL is the system of record for domain state, audit references, and tenant scope. |
| File storage | Supabase Storage private buckets by default | Private files are accessed only through short-lived, authorization-checked signed URLs. |
| Realtime | Supabase Realtime selectively for approved messaging or status updates | Realtime is a delivery mechanism, never authorization or state truth. |
| Payments | Stripe Connect through a server-only provider adapter | Verified webhooks and reconciliation, not client redirects, establish payment state. |
| External work context | GitHub OAuth, API, and webhooks through an integration adapter | User-authorized context only; contribution activity is not automatic proof. |
| AI assistance | Server-only AI provider adapter governed by `AI_GOVERNANCE.md` | AI is assistive, source-linked, correctable, and never the final decision-maker. |
| Background jobs | Typed background job runner with durable retry and dead-letter behavior | Long-running, retryable, provider, scanning, AI, export, and reconciliation work never blocks the request path. |
| Observability | Error tracking plus OpenTelemetry-compatible traces, metrics, structured redacted logs, and audit events | Correlation IDs connect request, domain event, job, provider, and user-impact telemetry without logging secrets/private content. |

## Modular-monolith map

Each module owns its domain commands, validation, queries, events, jobs, policy checks, and tests. Cross-module workflows call an application/domain service or publish a durable event; UI components never call several unrelated tables.

| Module | Owns canonical concepts | Allowed responsibility | Explicitly does not own |
|---|---|---|---|
| **Identity and access** | Person, session, consent, identity factors, recovery | Authentication, account controls, session context, consent | Skill verification, organization membership decisions, or payment truth. |
| **Organizations and memberships** | Organization, membership, organization verification, role assignment | Tenant boundaries, member lifecycle, organization permissions | Personal profile, project content, or provider payment state. |
| **Skills and taxonomy** | Skill, skill level, relations, taxonomy versions | Versioned vocabulary and evidence expectations | Reputation decisions or proof publication. |
| **Talent profiles and evidence** | Talent profile, availability, preferences, discoverability, evidence items, submission versions, attachments | Personal work identity, provenance, draft/submission access, private evidence | Human review decisions, public proof verification, or hiring decisions. |
| **Projects and challenges** | Project, challenge, requirements | Organization-owned opportunity definition, project lifecycle, application context | Workspace access enforcement, payment settlement, or proof verification. |
| **Applications and workspaces** | Application, workspace, workspace member, task, access grant | Requests to participate, authorized execution context, membership/access grants | Organization ownership, review decisions, or contract/payment truth. |
| **Submissions and reviews** | Submission, rubric/version, reviewer profile, assignment, review, decision | Versioned submission review, conflict checks, feedback, human accountability | AI final decisions, proof publication, money decisions, or organization membership. |
| **Proof Graph and reputation** | Proof, proof relation, reputation event, endorsement | Verification chain, visibility decision, publication/revocation, auditable reputation | Source submission content, reviewer eligibility policy, contract state, or payment truth. |
| **Hiring and contracts** | Paid trial, contract/version, milestone, change order, acceptance | Bounded opportunities, agreement terms, contract lifecycle, outcome context | Provider financial truth, proof verification, or organization membership. |
| **Payments and payouts** | Payment, payment attempt, payout, ledger, refund, reconciliation | Stripe Connect intents/provider events, financial state, reconciliation, payout eligibility | Client-provided payment claims, review outcome, or proof state. |
| **Messaging and notifications** | Conversation/message thread, participants, messages, notifications, preferences | Participant-scoped communication and delivery | Domain state transitions, authorization grants, contract acceptance, or proof. |
| **AI assistance** | AI use-case registry, prompt/model versions, assistive outputs, evaluation records | Approved summarization, tagging, matching suggestions, anomaly signals, and human handoff | Verification, hiring, rejection, money, enforcement, disputes, or account actions. |
| **Trust, moderation, and administration** | Report, trust signal, dispute case, evidence, enforcement, appeal, policy, queue, admin action, incident | Safety queues, policy decisions, appeals, least-privilege operations, incident response | Silent source-record rewrites or bypasses of domain state machines/RLS. |

### Data ownership map

| Source of truth | Owning module | Referenced by |
|---|---|---|
| Organization scope and membership | Organizations and memberships | Every organization-scoped module and RLS policy |
| Project/application lifecycle | Projects and challenges | Applications/workspaces, hiring/contracts, events, analytics |
| Workspace access and submission provenance | Applications/workspaces; submissions/evidence for content | Reviews, proof, trust, exports, signed URL checks |
| Review assignment, rubric, decision, and conflict | Submissions and reviews | Proof, reviewer economics, trust, audit |
| Proof publication/revocation and reputation events | Proof Graph and reputation | Discovery, profiles, analytics, trust; never rewritten by consumers |
| Contract terms and milestones | Hiring and contracts | Payments, workspaces, disputes, outcomes |
| Payment/payout/provider state | Payments and payouts | Hiring/contracts, notifications, reconciliation, audit |
| Communication delivery | Messaging and notifications | Contextual workflows; never domain state truth |
| AI output and evaluation metadata | AI assistance | Authorized source module, with human confirmation before persisted fact |
| Safety and case resolution | Trust, moderation, and administration | Restricted authorized operations and appeals |

## Next.js App Router and request boundaries

The codebase should keep transport, application orchestration, domain rules, data access, and provider adapters separate within the Next.js repository. Exact directories are implementation detail for a later scaffold, but the boundary is fixed:

```text
app/                         # App Router routes, layouts, loading/error states
  (public)/                  # public Server Component routes
  (authenticated)/           # authenticated layouts and role-aware route shells
  api/                       # versioned route handlers and provider webhooks
components/                  # presentational and client-interaction components
modules/<owner>/              # domain commands, queries, policies, schemas, events, jobs, tests
server/auth/                 # Supabase SSR session and authorization context
server/db/                   # server-only Supabase/PostgreSQL access and transactions
server/providers/            # GitHub, Stripe, email, AI, storage, and observability adapters
server/jobs/                 # typed job definitions, workers, retries, dead letters
```

**Server Components** read authorized data through server queries and render the result. They do not expose secrets or call providers from the browser. **Client Components** handle local interaction, optimistic presentation only after a server contract exists, and accessible UI states; they call typed server actions or route handlers and never write Supabase tables directly. `use client` is not a business-logic boundary.

**Server actions and route handlers** authenticate the session, validate a versioned input schema, authorize the exact action and organization scope, execute a domain command, record an audit/event, and return a typed envelope. Mutations use idempotency keys where required. Authorization failures that could disclose private existence return the stable `NOT_FOUND_OR_PRIVATE` shape.

A response envelope contains `requestId` and either typed `data` or a typed `error`; it may include `nextAction` and a concurrency `version`/`updatedAt`. Domain errors include `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND_OR_PRIVATE`, `INVALID_STATE`, `VALIDATION_FAILED`, `CONFLICT`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, and `RETRYABLE_FAILURE`.

## Authentication, authorization, and server/client boundaries

Supabase Auth supplies identity and session state. The server creates the request context from the secure session cookie using the official SSR pattern. Every mutation checks authentication, exact role/action permission, organization membership where applicable, current domain state, consent, and policy version. Admin actions require explicit elevated access and an audit record.

The browser may use only the Supabase project URL and publishable/anonymous key for approved client-side session flows. The service-role key, database connection credentials, provider secrets, webhook secrets, encryption keys, signing keys, queue credentials, and AI provider credentials are server-only managed secrets. They must never appear in client bundles, `.env` commits, logs, traces, analytics, screenshots, or support material.

RLS is defense in depth and a required database boundary, not a replacement for server authorization. Every table has RLS. Policies enforce authenticated identity, organization membership, participant access, explicit visibility, and least privilege. Server queries still scope by tenant and role. The server never relies on a client-selected organization ID, owner ID, audit actor, verification result, payment state, or public visibility.

Private evidence and attachments live in private Supabase Storage buckets. A server authorization check validates the user, ownership/participant grant, file purpose, type, size, scan state, and expiration before issuing a short-lived signed URL. Uploads are scanned before availability to other users. Public proof contains only approved, consented, visibility-safe representations; it does not create public access to private source files.

## Supabase/PostgreSQL strategy

PostgreSQL is the source of truth for canonical domain records, lifecycle state, organization scope, visibility, versions, audit references, and durable outbox/job references. Supabase clients are split by boundary:

| Access path | Use | Prohibited |
|---|---|---|
| Browser Supabase client | Session-aware UI flows and narrowly approved realtime subscriptions | Service-role access, direct cross-domain mutations, private file enumeration, or trust/payment state changes |
| Server user-scoped client | RLS-enforced authorized reads and safe commands | Bypassing domain services or treating browser payloads as ownership truth |
| Server privileged client | Narrow operations that require elevated access, each with explicit policy, audit, and redaction | General application queries, user-controlled filters, or bypassing RLS without a documented reason |
| PostgreSQL transaction | Atomic domain state change, audit reference, idempotency record, and outbox entry | External network calls or unbounded work inside a transaction |
| Storage signed URL | Short-lived authorized download/upload of private files | Long-lived public links or URLs without purpose and expiry |

Use database constraints for enum/state validity, amounts in integer minor units, required organization scope, uniqueness, and foreign keys with explicit deletion behavior. Use additive migrations and measured indexes. `pgvector` is deferred until an explainable, approved matching need and cost review exist; it is not a default feature.

## Request and event flows

### Authenticated mutation

1. A Server Component or Client Component submits a typed request to a server action or versioned route handler.
2. The server authenticates the Supabase SSR session and builds actor, organization, consent, and correlation context.
3. The boundary validates the versioned schema, idempotency key, authorization, RLS-compatible scope, and current domain state.
4. The owning module's domain command applies invariants and writes the state change, audit reference, and outbox event in one transaction.
5. The response returns typed data or a recoverable domain error with `requestId`, version, and next action where safe.
6. Durable consumers perform notifications, indexing, provider calls, analytics, or other asynchronous work outside the request transaction.

### Durable event

Every event has an immutable `eventId`, unique `eventType`, `schemaVersion`, `occurredAt`, actor/system source, organization scope when applicable, aggregate type/ID, causation ID, correlation ID, privacy classification, retention class, and minimal source references. Event consumers are idempotent, version-tolerant, and must not duplicate payment, payout, proof, reputation, or notification side effects.

Canonical event families remain `identity.*`, `membership.*`, `consent.*`, `project.*`, `application.*`, `workspace.*`, `submission.*`, `review.*`, `proof.*`, `reputation.*`, `conversation.*`, `message.*`, `notification.*`, `contract.*`, `milestone.*`, `payment.*`, `payout.*`, `ledger.*`, `reviewer.earning.*`, `reviewer.payout.*`, `billing.*`, `report.*`, `dispute.*`, `enforcement.*`, `appeal.*`, `admin.*`, `incident.*`, `config.*`, `analytics.*`, and `experiment.*`.

### Provider webhook

1. Receive a bounded webhook request and verify signature, provider account, event age, and uniqueness.
2. Persist a restricted/redacted raw event and provider event ID before acknowledging.
3. Map it through the provider adapter to an internal command/event with the correct organization and aggregate context.
4. Process it idempotently; update provider state and reconciliation records transactionally.
5. Enqueue follow-up work when needed; retry transient failures and route poison messages to a dead-letter queue.

A duplicate or out-of-order webhook is safe because provider event IDs, internal idempotency keys, state preconditions, and unique ledger/reconciliation constraints prevent duplicate side effects. UI redirects never establish payment, payout, proof, or verification truth.

## Provider adapter boundaries

Providers are replaceable infrastructure dependencies, not domain vocabulary. The UI and domain modules consume typed capability interfaces and normalized results; they never import provider SDK details or inspect provider-specific statuses.

| Adapter | Server-only responsibilities | Domain contract | Failure behavior |
|---|---|---|---|
| **Supabase Auth/SSR** | Session exchange, cookie handling, token refresh, auth errors | `Person` identity and consent context | Return safe auth error; never expose token details. |
| **Supabase Storage** | Private bucket access, scan status, signed URLs | Evidence/attachment access grant and retention | Deny by default; retry safe storage operations; expire URLs quickly. |
| **GitHub** | OAuth exchange, token storage, authorized API reads, webhook verification, sync cursor | User-authorized contextual external evidence; provider snapshot | Backoff/rate-limit job, preserve last safe snapshot, surface stale state; never infer proof. |
| **Stripe Connect** | Payment intents, connected accounts, webhook verification, refunds, reconciliation | Payment/payout/provider state and contract prerequisites | Idempotent retry, reconcile, hold/restrict on mismatch; no client-side success trust. |
| **Email** | Transactional delivery and template/version tracking | Notification delivery status | Retry with dedupe; dead-letter after policy limit; do not block domain command. |
| **AI provider** | Server-only request, redaction, model/prompt version, evaluation, source IDs | Assistive output with uncertainty and human confirmation | Timeout/fallback/disable path; never persist unconfirmed output as verified fact. |
| **Error/tracing provider** | Redacted error events, traces, metrics, alert routing | Operational observability only | Local fallback logging without secrets; never log private content. |

## Environment variable contract

Maintain a validated `.env.example` containing names, owner, required environments, sensitivity, rotation policy, and failure behavior, but no secret values. The exact provider account values are supplied only by managed environment configuration.

| Variable class | Example variable names (names only) | Scope and behavior |
|---|---|---|
| App | `NEXT_PUBLIC_APP_URL`, `APP_ENV`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public URL/environment and publishable Supabase values; safe only for approved browser use. |
| Supabase server | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` | Server-only; privileged access is narrow, audited, and never exposed to clients. |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET` | Server-only secrets and webhook verification; tokens are encrypted/rotated. |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID` | Server-only provider operations; verified webhook and reconciliation required. |
| Email | `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM_ADDRESS` | Server-only delivery; sender policy and rotation required. |
| AI | `AI_PROVIDER_API_KEY`, `AI_MODEL_REGISTRY_REF`, `AI_DISABLED` | Server-only; registry, model/version, disable flag, allowed data class, and fallback required. |
| Jobs and encryption | `JOB_DATABASE_URL`, `JOB_ENCRYPTION_KEY`, `WEBHOOK_ENCRYPTION_KEY` | Server/worker-only; rotate without placing raw secrets in payloads or logs. |
| Observability | `ERROR_TRACKING_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ANALYTICS_WRITE_KEY`, `ALERT_WEBHOOK_URL` | Server/worker-only as appropriate; redact privacy-sensitive attributes. |

Every variable has an owner, environment scope, rotation procedure, and failure mode. Missing optional providers fail closed or degrade to a documented state; missing required security or database configuration blocks startup and deployment. Secret replacement, rotation, and access review are operational events.

## Background job contract

Long-running or retryable work runs in a typed background job runner, not inside a Next.js request or database transaction. Each job includes a typed name, `schemaVersion`, deduplication key, attempt count, max age, timeout, retry/backoff policy, owner, privacy class, retention class, correlation/causation IDs, and dead-letter policy. Payloads contain secure references, not raw secrets, card/bank data, private message bodies, or unrestricted evidence.

| Job family | Owner | Trigger | Idempotency and safety |
|---|---|---|---|
| Notifications and email | Messaging | Domain event | Template/version plus recipient/event dedupe; retries and dead letters. |
| GitHub sync and rate-limit recovery | Integrations | OAuth connection, webhook, scheduled cursor | Provider account/cursor key; stale snapshots remain labeled stale. |
| Upload scanning and preview | Evidence | Private upload reference | File ID/version key; quarantined until scan passes. |
| Review/AI assistance and anomaly signals | Reviews/AI/Trust | Approved command or event | Source/version/model key; human confirmation before consequential persistence. |
| Search/index refresh | Search/owning module | Public-safe record event | Aggregate/version key; deleted/revoked records removed before indexing. |
| Payment reconciliation and webhook replay | Payments | Provider event or schedule | Provider event ID/aggregate key; unique ledger constraints and replay audit. |
| Payout status sync | Payments | Provider event or schedule | Provider payout ID; held/failed states are explicit. |
| Exports, deletion, retention, and legal hold | Identity/Trust/Admin | User or policy event | Subject/purpose/version key; propagate visibility and deletion to derived stores. |
| Analytics outbox delivery | Analytics | Domain event | Event ID; aggregate/pseudonymous data only. |
| Backup verification and health checks | Administration | Schedule | Run ID; evidence artifact and alert on failure. |

The job runner must support retry, timeout, pause/disable, replay, dead-letter inspection, and safe shutdown. Jobs re-authorize access at execution time and must not assume a stale permission or visibility decision.

## Untrusted code and file processing

User-submitted code, build commands, repository content, archive extraction, and other untrusted execution are never run in the Next.js web process, worker process with application credentials, or Supabase database. If later approved, execution uses an isolated ephemeral sandbox with least-privilege network/filesystem access, resource limits, timeouts, no production credentials, sanitized outputs, and a separate security review. Phase 05 authorizes no code-execution feature.

Uploads are private, type/size/ownership validated, scanned in a background job, and available only through authorized short-lived signed URLs. Malicious links, secrets, prompt injection, and archive traversal are threat-model inputs.

## Observability and audit

Use one correlation ID across request, domain command, transaction, event, job, provider webhook, and user-impact alert. Structured logs are redacted and include environment, module, operation, actor type (not unnecessary identity data), organization scope, request/event/job IDs, status, latency, retry count, and error code. Never log secrets, private messages, private evidence, identity documents, payment data, raw prompts, or unrestricted provider payloads.

| Signal | Required instrumentation |
|---|---|
| Request health | Request ID, route/action, status, latency, error code, authorization outcome, and safe next action. |
| Domain integrity | State transition, actor/system, aggregate, policy version, audit ID, idempotency result, and invalid-transition counts. |
| RLS/security | Denials, cross-tenant attempts, sensitive reads/exports, signed URL issuance, admin actions, and rate limits. |
| Jobs | Queue age, attempts, throughput, timeouts, dead letters, replay, dependency status, and privacy class. |
| Providers | Webhook verification, event uniqueness, provider state, retries, rate limits, reconciliation mismatches, and outage mode. |
| Payments | Funding/release/refund/hold/chargeback, ledger reconciliation, payout failures, and duplicate-event prevention. |
| AI | Model/version, policy version, source IDs, uncertainty, latency, human action, correction/override, cost, and disable state without unnecessary private content. |
| User impact | Safe alerts for stalled proof publication, failed submission, blocked payment, notification failure, deletion backlog, or privacy exposure. |

Error tracking and OpenTelemetry-compatible traces are configured per environment with redaction and sampling. Audit events are append-only and retained under policy. Public analytics are aggregated/pseudonymous and never become domain truth.

## Migration, release, and rollback principles

Schema and contract changes use reviewable, additive **expand-and-contract** migrations. Each migration records version, owner, reason, affected modules, data classification, risk, indexes/constraints, backfill plan, validation queries, rollout flag, rollback or compensation plan, and restoration evidence.

1. Expand with nullable/additive fields, compatible event versions, or new tables/indices.
2. Deploy code that can read old and new forms, guarded by a feature flag where needed.
3. Backfill in bounded, observable jobs with pause/retry/dead-letter behavior.
4. Validate counts, constraints, RLS, visibility, performance, provider reconciliation, and critical journeys in staging.
5. Contract only after consumers are migrated and measured; destructive removal requires a separate approval.

Backups are encrypted and restoration is tested before destructive changes. A release rollback reverts application code or disables a feature flag; it does not delete or rewrite user, payment, ledger, proof, review, dispute, audit, or event history. When data has already changed, use a forward fix or compensating record. After recovery, reconcile payments, webhooks, notifications, proof publication, deletion, retention, and analytics before normal operation is declared.

## Deployment and CI/CD principles

| Environment | Purpose | Required controls |
|---|---|---|
| Local | Safe development with synthetic data and mock/sandbox providers | No production secrets; isolated local Supabase or approved test project. |
| Preview | Per-change validation | Isolated Supabase project/schema, test payment accounts, redacted logs, and disposable data. |
| Staging | Production-topology rehearsal | Migrations, jobs, webhooks, backup restore, RLS, contract tests, and end-to-end journeys. |
| Production | Approved release window | Managed secrets, separate provider accounts, restricted access, monitoring, rollback, and on-call readiness. |

GitHub Actions is the CI/CD control plane. Pull requests must run formatting, ESLint with zero warnings, strict TypeScript, unit and targeted integration tests, RLS/authorization tests, contract/schema compatibility tests, accessibility/smoke tests, and dependency/security scans. Release workflows additionally run the Next.js production build, migration checks, end-to-end tests, performance smoke, artifact integrity, and rollback verification before deployment.

The production release gate blocks on high-severity security/privacy/payment/trust issues, broken critical journeys, unverified environment variables, inactive error monitoring, unapproved migrations, or an undocumented rollback path. This phase defines the gate; it does not create workflows or deploy an application.

## Failure modes and unresolved architecture risks

| Risk or failure mode | Default response | Decision needed before implementation |
|---|---|---|
| Supabase/RLS query complexity or performance | Measure query patterns, use server-side pagination, indexes from evidence, and policy tests | Approve query/index budget and policy review process. |
| Job runner durability and operational load | Start with one typed runner and explicit queues/dead letters; extract only when justified | Select runner, persistence, worker hosting, and ownership. |
| GitHub rate limits or stale data | Cursor-based sync, provider snapshots, backoff, visible stale state | Approve scopes, retention, deletion, and sync cadence. |
| Stripe/provider outage or mismatch | Provider outage mode, idempotent replay, reconciliation, financial hold | Approve market/payment register, webhook replay access, and runbook. |
| Signed URL leakage or malicious upload | Private buckets, short expiry, scan quarantine, access audit, redacted previews | Approve file limits, scanners, and retention. |
| AI privacy, prompt injection, or model drift | Server-only adapter, minimum data, registry/evaluation, disable flag, human confirmation | Approve each use case, model/version, evaluation set, and data region. |
| Untrusted code execution | Keep out of app/worker; require isolated sandbox design and security review | No execution feature until approved. |
| Realtime leakage or stale authorization | Use only for approved status/message updates; re-check authorization on reads | Approve channels, payload classification, and revocation behavior. |
| Global market and provider readiness | Feature/market flag; block unsupported locale, currency, tax, worker, or payment flow | Maintain approved market register before launch. |
| Small-team operational burden | Prefer managed Supabase/provider services, one modular monolith, standard adapters, and runbooks | Assign owners and on-call capacity before production. |

## Architecture review checklist

A new feature is assignable to one primary module by first identifying its canonical entity and source of truth. Cross-module effects are emitted as typed events or orchestrated by a domain service. No UI component needs provider-specific details because adapters normalize provider capabilities and statuses. A failed provider request can be retried safely because calls use idempotency, bounded retries, deduplication, and reconciliation. A duplicate webhook cannot duplicate a payment, proof, or reputation event because event uniqueness, aggregate preconditions, transactional outbox processing, and append-only constraints are required.

The architecture is intentionally realistic for a small team using Manus: one Next.js App Router application, one Supabase/PostgreSQL system of record, managed provider adapters, one typed background-job boundary, explicit module contracts, GitHub Actions gates, and observable runbooks. Extraction is a measured response to a real boundary, not a default.

## Approval gate

No feature implementation, database migration, provider integration, or UI work begins from this document until the relevant module boundary, data/RLS policy, API/event contract, test plan, environment contract, and operational owner are approved. Later phases must implement one module at a time without bypassing Next.js App Router, server/client boundaries, RLS, provider adapters, background-job safety, or human accountability.
