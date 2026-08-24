# Proofly Domain Model

## Purpose and scope

This document is the canonical shared vocabulary and state model for Proofly's first-release proof-to-opportunity loop. It defines actors, entities, relationships, ownership boundaries, visibility, naming, invariants, and state transitions before feature or schema implementation begins.

**Phase 04 is documentation-only.** No database tables, migrations, UI, integrations, or product features are authorized by this document. State transitions are domain commands to be implemented and tested in later phases; they are not evidence that any behavior already exists.

The model preserves the approved wedge of junior and early-career software developers, startups and small product teams, and qualified human reviewers. A `Person` may hold more than one role, but each action is authorized and audited in its active context.

## Canonical actors

Actors are people or organizations that can own, perform, authorize, or receive domain actions. A role is not a separate account type.

| Actor | Definition | Can do | Cannot imply |
|---|---|---|---|
| **Person** | An authenticated human who may participate as talent, reviewer, company member, or administrator | Act only through an authenticated session and an explicitly authorized role/context | Identity assurance is not proof of skill, trustworthiness, or hiring suitability. |
| **Talent** | The person role that chooses work, submits evidence, receives review, controls public proof, and pursues an opportunity | Create or join eligible work, submit versions, respond to review, apply to opportunities, and accept paid work | A talent role is not a candidate score, employment status, or verified skill by itself. |
| **Company member** | A person acting for an organization through a versioned membership and role assignment | Create and manage organization-owned projects, review authorized evidence, and act for the organization within granted permissions | A company member is not the organization owner by default and cannot take organization scope from a client request. |
| **Reviewer** | A qualified human authorized to evaluate a submission against a rubric | Accept eligible review assignments, declare conflicts, evaluate, give feedback, challenge or finalize according to policy | A reviewer is not an automated verifier, hiring decision-maker, or person paid for a favorable outcome. |
| **Administrator** | A person with explicit elevated operational or policy permissions | Perform least-privilege administrative actions with an audit record and applicable case or policy reference | Administrator access does not bypass RLS, domain state machines, privacy, or audit history. |
| **Organization** | A company or team tenant that creates projects, manages members, reviews talent, and pays for work | Own organization-scoped projects and contracts, authorize members, and manage organization financial context | An organization is not a person, reviewer, talent profile, or public proof. |

### Organization ownership rule

An organization, not an individual company member, owns company-scoped `Project`, `Challenge`, `Application` context, `Workspace`, `Paid trial`, `Contract`, billing, and payment records where the data model assigns organization scope. A `Membership` grants a person permission; it does not transfer ownership. If a member leaves while owning or managing an active project, the project remains with the organization, the member's access is revoked, and an authorized organization administrator must assign a replacement manager or place the project into an approved restricted state. No client payload can choose or change organization scope.

## Canonical entities and module ownership

Every core entity has one canonical definition and one owning domain module. A module may reference another module's entity, but it does not rewrite that entity's source truth.

| Entity | Canonical definition | Owning module | Primary owner/scope |
|---|---|---|---|
| **Organization** | A company or team tenant with members, projects, and financial responsibility | Organizations | Organization record; organization administrators manage membership. |
| **Membership** | A versioned relationship between one `Person` and one `Organization` with role assignments and status | Organizations | The organization governs membership; the person controls their account. |
| **Skill** | A capability in the Proofly taxonomy with evidence expectations and related skills | Skills | Taxonomy owner; not a reputation score. |
| **Skill level** | A defined level within a `Skill` with its evidence requirements | Skills | Taxonomy owner; never inferred from activity alone. |
| **Project** | A defined piece of work with requirements, evaluation criteria, budget, and lifecycle state | Projects | Organization scope; company members act through membership. |
| **Challenge** | A `Project` intended to create comparable evidence across multiple participants | Projects | Organization scope; retains Project ownership and lifecycle rules. |
| **Application** | A talent request to participate in a project or opportunity | Projects | Talent submits it; project organization provides the opportunity context. |
| **Workspace** | An authorized execution context for a project, challenge, task, or milestone | Workspaces | Organization/project scope with explicit members and access grants. |
| **Submission** | A versioned set of work and explanation submitted for review | Evidence | Talent submits it; workspace or challenge supplies the work context. |
| **Review rubric** | A versioned set of evaluation criteria used to assess a submission | Reviews | Review policy owner; the rubric version is immutable once used for a decision. |
| **Review** | A structured human evaluation of a submission against a rubric | Reviews | Assigned reviewer and review policy; conflicts are explicit. |
| **Proof** | An evidence record linking a person, skill, submission version, review decision, reviewer, visibility policy, and outcome | Proof | Proof module; public only after valid verification and consent. |
| **Proof Graph** | The connected history of skills, evidence, reviews, projects, outcomes, and endorsements | Proof | Proof module; relations are auditable and visibility-aware. |
| **Reputation event** | A traceable event that changes a reputation signal, such as verified skill, completed project, late delivery, or confirmed outcome | Proof | Append-only proof/reputation history; source event and visibility decision required. |
| **Endorsement** | A user-attributed statement or relation supporting a person's work or skill, subject to visibility and trust policy | Proof | Proof module; never upgrades a claim into verified proof alone. |
| **Message thread** | A contextual conversation between authorized participants | Communication | Participant scope; the data-contract implementation identifier is `Conversation`, which is not interchangeable with other user-facing terms. |
| **Paid trial** | A bounded paid engagement that lets a company and talent evaluate collaboration before a larger contract | Engagements | Parties and organization context; terms are explicit and immutable by version. |
| **Contract** | An agreement defining parties, scope, milestones, payments, and status | Engagements | Contract parties and organization context; versions preserve history. |
| **Milestone** | A bounded contract deliverable or acceptance unit with terms and status | Engagements | Contract scope; acceptance is recorded, not inferred from a message. |
| **Payment** | A financial obligation or transfer record tied to an accepted contract or milestone and provider state | Payments | Provider/reconciliation boundary; client claims never establish payment truth. |
| **Payout** | A provider-mediated transfer from an approved balance or earning to an eligible recipient | Payments | Provider/reconciliation boundary; payout eligibility is separate from proof or review outcome. |
| **Dispute** | A structured case raised when a project, review, payment, contract, or interaction is contested | Trust | Trust/case owner; it references source truth and does not silently rewrite it. |
| **Report** | A submitted safety, integrity, or policy concern that may create a restricted trust case | Trust | Reporter and trust queue; a report is not a finding or a dispute outcome. |

### Supporting implementation entities

The canonical domain model also relies on `EvidenceItem`, `SubmissionVersion`, `Attachment`, `ReviewerAssignment`, `ReviewDecision`, `ProofRelation`, `ReputationEvent`, `ContractVersion`, `PaymentAttempt`, `LedgerEntry`, `CaseEvidence`, and `EnforcementAction` defined by the data and trust contracts. These supporting records must not create a second definition for a core entity or bypass the owner listed above.

## Relationships and ownership boundaries

| Relationship | Rule |
|---|---|
| Person ↔ Organization | A `Membership` joins one person to one organization with a versioned role assignment. One person may have multiple memberships and roles. |
| Organization → Project | A project has exactly one owning organization. A company member may act on it only through an active, authorized membership. |
| Project → Challenge | A challenge is a project subtype or purpose, not a separate job/gig concept. It retains the project's organization, requirements, rubric context, and lifecycle. |
| Project → Workspace | A project may create one or more workspaces. Workspace membership and access grants determine who can view or act on private work. |
| Project → Application | An application belongs to one talent, one project, and one organization context. It is a request, not an acceptance, hire, or contract. |
| Workspace/Challenge → Submission | A submission is versioned and belongs to one authorized workspace/task or challenge. Private evidence is restricted to authorized participants. |
| Submission → Review | A submission version may be reviewed only through an eligible reviewer assignment. A review references one rubric version and records a human decision. |
| Review → Proof | A proof references an exact submission version, finalized review decision, rubric version, skill, reviewer, visibility policy, and current status. A review suggestion alone is not proof. |
| Proof → Proof Graph | Proof, proof relations, reputation events, and eligible endorsements form the connected Proof Graph. Each reputation change references a source event and an authorized visibility decision. |
| Application → Paid trial | An accepted application may provide context for a bounded paid trial. Creating a trial does not silently accept an application or create a contract. |
| Paid trial → Contract | A paid trial may progress to a contract only through an explicit, versioned agreement between authorized parties. |
| Contract → Milestone → Payment | Contract versions define immutable milestone terms. A payment references an accepted contract or milestone and provider attempts/ledger entries. |
| Payment → Payout | A payout is provider-mediated and eligibility-controlled. Payment success, payout eligibility, and proof/review outcome remain separate signals. |
| Report → Dispute | A report may create a restricted trust case. A dispute references the affected source record and preserves its audit history. |
| Message thread → domain context | A message thread is participant-scoped and contextual. It cannot establish project, review, proof, contract, payment, or dispute truth by itself. |

## Visibility and data boundaries

Every persisted record has explicit visibility, lifecycle, retention, and audit behavior. The following product boundary applies before implementation:

| Data class | Default visibility | Boundary |
|---|---|---|
| Person account and personal profile | `private` | User-controlled subject to obligations; never a public proof by default. |
| Organization and membership | `organization` or `private` | Visible only to authorized members and operations; membership does not expose identity evidence. |
| Project/challenge requirements | `organization`, `participants`, or `public` by policy | Public discovery must not expose private project materials or organization data. |
| Workspace and submission/evidence | `participants` or `restricted` | Only authorized workspace participants, reviewers, and approved operations may access private materials. |
| Review and reviewer-conflict data | `participants` or `restricted` | Reviewer identity, conflicts, internal quality signals, and private feedback follow policy; public proof exposes only approved context. |
| Proof and approved proof relations | `public` only after consent and verification; otherwise `private` or `restricted` | Public proof must point to a valid, non-revoked evidence/review chain and can be unpublished or revoked without deleting audit history. |
| Reputation event and endorsement | Explicit per-event visibility | A reputation event requires a source event and authorized visibility decision; endorsements never override proof rules. |
| Message thread | `participants` | Never expose private message bodies through search, notifications, exports, links, or AI processing without an approved data boundary. |
| Paid trial, contract, milestone, payment, and payout | `participants`, `organization`, or authorized operations | Terms, tax, payment, and payout data remain private; provider state is authoritative for financial status. |
| Dispute and report | `restricted` | Safety and integrity cases are not public by default; case evidence is purpose- and queue-limited. |

A private record cannot become public through an attachment, cache, notification, export, search index, link preview, or message thread. Identity assurance, organization confirmation, reviewer approval, payout eligibility, and work verification remain separate signals.

## State-machine conventions

State is changed by an authenticated server-side domain command, not by an arbitrary client update. Every command validates actor, organization scope, prior state, required evidence, policy version, and authorization. A successful transition creates an append-only audit/event record with an idempotency key where the API/event contract requires one. Invalid transitions fail without partial mutation.

Unless a transition is explicitly listed as valid, it is invalid. Terminal states are readable to authorized auditors even when public visibility is revoked. Corrections create a new version or compensating record and do not rewrite history.

## Required state machines

### Project

Canonical lifecycle:

`draft -> published -> accepting applications -> in progress -> submitted -> reviewed -> completed -> archived`

| Current state | Valid next state | Required condition |
|---|---|---|
| `draft` | `published` | Authorized organization member has supplied requirements, evaluation criteria, visibility, and applicable budget/policy fields. |
| `published` | `accepting applications` | Project is open for eligible applications and the organization has authorized the opportunity. |
| `accepting applications` | `in progress` | At least one application is accepted into active work and the workspace/access grants exist. |
| `accepting applications` | `completed` | Authorized organization closure records `completion_reason=no_accepted_submission`; no accepted submission is implied. |
| `accepting applications` | `archived` | Authorized closure occurs before work begins, with an audit reason and no active obligations. |
| `in progress` | `submitted` | At least one authorized submission is submitted for the project/challenge. |
| `submitted` | `reviewed` | Required submission review decisions are finalized or the project closure policy explicitly records an incomplete/declined review outcome. |
| `reviewed` | `completed` | Authorized project owner records the project outcome, including `no_accepted_submission` where applicable. |
| `completed` | `archived` | Retention and operational policy permit archival; audit history remains. |

A project may not jump from `draft` to `completed`, from `published` to `reviewed`, or from `completed` back to an active state. A company closing with no accepted submission uses an explicit closure reason; it does not fabricate a submission, proof, review, or outcome.

### Application

Canonical lifecycle:

`draft -> submitted -> shortlisted -> invited to trial -> accepted or rejected -> withdrawn`

| Current state | Valid next state | Required condition |
|---|---|---|
| `draft` | `submitted` | Talent submits a complete application to one project with an idempotency key. |
| `submitted` | `shortlisted` | Authorized company member records an evidence-linked shortlist decision. |
| `submitted` | `rejected` | Authorized company member records a rejection reason or policy outcome. |
| `shortlisted` | `invited to trial` | Authorized company member issues a bounded paid-trial invitation with scope and terms. |
| `shortlisted` | `withdrawn` | Talent withdraws before an invitation is accepted. |
| `invited to trial` | `accepted` | Talent accepts the explicit trial invitation; this does not create a contract unless separately agreed. |
| `invited to trial` | `rejected` | Authorized company member or policy process declines the invitation with an auditable reason. |
| `invited to trial` | `withdrawn` | Talent withdraws before acceptance. |
| `accepted` | `withdrawn` | Withdrawal is allowed only before a dependent paid trial or contract has started and must resolve any obligation safely. |
| `rejected` | `withdrawn` | Administrative redaction/withdrawal may remove the application from active presentation without rewriting the rejection audit event. |

An application cannot become `accepted` through a message, payment redirect, or client-side claim. `accepted` supplies context for a paid trial; it is not a contract or proof.

### Submission

Canonical lifecycle:

`draft -> submitted -> under review -> changes requested -> resubmitted -> accepted or rejected`

| Current state | Valid next state | Required condition |
|---|---|---|
| `draft` | `submitted` | Talent submits a versioned work set and explanation to the authorized workspace/challenge. |
| `submitted` | `under review` | An eligible reviewer assignment exists and the submission is available to that reviewer. |
| `under review` | `changes requested` | Reviewer records actionable feedback and required changes; no final acceptance is implied. |
| `under review` | `accepted` | Reviewer finalizes an accepting decision against the current rubric version. |
| `under review` | `rejected` | Reviewer finalizes a rejecting decision with an auditable reason; the submission cannot be public proof. |
| `changes requested` | `resubmitted` | Talent submits a new version that addresses or responds to requested changes. |
| `resubmitted` | `under review` | An eligible reviewer assignment reopens review of the new version. |
| `resubmitted` | `accepted` | Authorized review finalizes acceptance of the new version. |
| `resubmitted` | `rejected` | Authorized review finalizes rejection of the new version. |

A revision after changes are requested creates a new `SubmissionVersion`; it does not overwrite the prior version or erase the review history. A submission cannot jump from `draft` to `accepted`, and a rejected version cannot silently become accepted without a new valid version and review.

### Review

Canonical lifecycle:

`assigned -> accepted -> in progress -> submitted -> challenged or finalized`

| Current state | Valid next state | Required condition |
|---|---|---|
| `assigned` | `accepted` | Eligible reviewer accepts the assignment after expertise, conflict, conduct, and authorization checks. |
| `assigned` | `challenged` | Assignment or conflict is challenged through an authorized trust/appeal path before work proceeds. |
| `accepted` | `in progress` | Reviewer begins work after assignment acceptance and required submission access is granted. |
| `accepted` | `challenged` | A conflict, access issue, or assignment concern is raised and recorded. |
| `in progress` | `submitted` | Reviewer submits a complete rubric-based evaluation and feedback. |
| `in progress` | `challenged` | A conflict, integrity issue, or process challenge is recorded. |
| `submitted` | `finalized` | Authorized review process confirms the decision and locks the rubric version. |
| `submitted` | `challenged` | Talent, company, reviewer, or trust process raises a documented challenge before finalization. |
| `challenged` | `in progress` | Authorized resolution returns the review for correction or re-review without rewriting history. |
| `challenged` | `finalized` | Authorized appeal/trust process finalizes the outcome with the challenge and resolution linked. |

A reviewer with a conflict of interest cannot move an assignment to `accepted`; the assignment must be declined, reassigned, or challenged. Reviewer compensation, when enabled, references accepted quality-controlled work and never depends on a favorable decision.

### Proof

Canonical lifecycle:

`private draft -> pending verification -> verified -> published -> revoked`

| Current state | Valid next state | Required condition |
|---|---|---|
| `private draft` | `pending verification` | Talent requests verification for a specific submission version and supplies the required consent/context. |
| `pending verification` | `verified` | A valid submission and finalized, eligible, conflict-free human review satisfy the proof policy. |
| `pending verification` | `private draft` | Required changes, missing evidence, failed checks, or withdrawn consent prevent publication; audit history remains. |
| `verified` | `published` | Talent makes the proof public under an explicit visibility decision and the chain remains valid. |
| `verified` | `revoked` | Proof is withdrawn, source evidence/review is invalidated, consent is withdrawn, or a policy process revokes public verification. |
| `published` | `revoked` | The source chain, consent, attribution, or policy no longer supports public proof. |

There is no public `rejected` Proof state. A failed or rejected verification remains private, is not published, or is revoked; it cannot silently remain publicly verified. Revocation removes public availability while preserving an authorized audit reference and any required retention/legal hold.

### Contract

Canonical lifecycle:

`draft -> offered -> accepted -> active -> completed -> disputed or closed`

| Current state | Valid next state | Required condition |
|---|---|---|
| `draft` | `offered` | Authorized parties have a versioned scope, milestones, payment terms, market/policy context, and expiration. |
| `offered` | `accepted` | Authorized parties accept the same immutable contract version; provider/payment prerequisites remain separate. |
| `offered` | `closed` | Offer expires or is withdrawn before acceptance, with an audit reason. |
| `accepted` | `active` | Required provider/payment state and start conditions are confirmed by the server; client redirects cannot establish activation. |
| `accepted` | `closed` | Contract is cancelled before work starts under the applicable policy and financial reconciliation rules. |
| `active` | `completed` | Contract parties or authorized acceptance process record completion of obligations and milestones. |
| `active` | `disputed` | A party or authorized trust process opens a dispute over scope, work, payment, or conduct. |
| `completed` | `disputed` | A dispute may be opened after completion when the policy permits; completion history is preserved. |
| `completed` | `closed` | All obligations, payments, payouts, and applicable holds/reviews are reconciled. |
| `disputed` | `closed` | Authorized resolution, settlement, correction, or appeal completes the case and linked financial actions. |

A contract cannot move from `draft` to `active`, from `offered` to `completed`, or from `closed` back to `active`. Contract status cannot be changed by the client alone. A payment success event does not accept an application, activate a contract, or create proof.

## Provider-aware payment and payout states

Payment and payout are separate entities and state machines from `Contract`. Their financial truth comes from verified, idempotently processed provider webhooks and reconciliation, not client claims or analytics events.

| Entity | Canonical provider-aware states | Rule |
|---|---|---|
| **Payment** | `created -> provider_pending -> authorized -> funded -> released`; exception states `failed`, `refunded`, `disputed`, `reconciled` | A provider event must be verified, persisted, deduplicated, and reconciled before internal state changes. A retry cannot duplicate a payment or application side effect. |
| **Payout** | `created -> provider_pending -> eligible -> paid`; exception states `failed`, `held`, `reversed`, `reconciled` | Eligibility and provider status are separate from review outcome and proof status. A client cannot mark a payout paid. |

If a payment succeeds while an application request is retried, the idempotency key and provider event ID keep the application transition and payment side effect separate and non-duplicating. The retry must observe existing state rather than create a second application, contract, payment, or payout.

## Domain invariants

1. A public `Proof` must reference a real, non-revoked `SubmissionVersion` and a finalized, eligible, conflict-free human `Review` decision under the referenced rubric version.
2. A reviewer must be eligible and conflict-free before accepting or finalizing a review. A reviewer cannot evaluate their own work or conflicted work.
3. A rejected submission or failed verification cannot silently remain publicly verified. Public proof is revoked or never published when the valid chain no longer exists.
4. `ReputationEvent` records are append-only, auditable, and linked to a source event and authorized visibility decision. Corrections create compensating records or versions.
5. Organization membership is required for company-owned projects, workspaces, applications in organization context, contracts, and financial actions. Membership changes cannot rewrite prior authorship or audit history.
6. Contract, payment, payout, and ledger states cannot be changed by the client alone. Provider transitions require verified, idempotent webhook processing and reconciliation.
7. A user cannot access another organization's private workspace, evidence, messages, contract terms, payment data, or trust case without explicit authorization and RLS-compatible scope.
8. A private record cannot become public through an attachment, cache, notification, export, search index, link preview, or AI output.
9. A `Proof` is not an identity-assurance level, a universal score, a portfolio, a resume, a certificate, or an endorsement. A `Review` is not AI analysis.
10. AI suggestions may assist with approved tasks but never create final verification, hiring, payment, enforcement, dispute, reviewer-approval, or account decisions by themselves.
11. Reviewer compensation, when enabled, is linked to an accepted, quality-controlled review and policy reason, never to score direction or favorable proof.
12. A `Dispute` or `Report` references source truth and cannot silently rewrite project, review, proof, contract, payment, or audit history.
13. Every state transition validates prior state, actor, organization scope, policy version, required evidence, and idempotency where applicable; invalid transitions fail without partial mutation.
14. Every public or organization-visible record has an explicit visibility decision, retention class, and deletion/revocation behavior.

## Naming rules and prohibited synonyms

Use one canonical term per concept in product copy, domain services, API/event contracts, analytics, and documentation. A data-contract implementation identifier may be different only when the mapping is explicitly recorded; it must not create a second user-facing concept.

| Canonical term | Use it for | Do not use as an interchangeable synonym |
|---|---|---|
| **Person** | Authenticated human account subject | User, member, candidate, reviewer account, or talent account when the base actor is meant |
| **Talent** | Person acting to prove skills and pursue an opportunity | Candidate, applicant, freelancer, contractor, or developer when the Proofly role is meant |
| **Company member** | Person acting for an organization through membership | Company, employer, organization owner, or hiring manager as a base entity |
| **Organization** | Company or team tenant and owner of company-scoped records | Company account, employer profile, workspace, or team member |
| **Project** | Defined piece of work with requirements and lifecycle | Job, gig, task, ticket, listing, or contract |
| **Challenge** | Project intended to create comparable evidence | Job, assessment, test, contest, or generic project when comparability is not intended |
| **Application** | Talent request to participate in a project/opportunity | Proposal, bid, offer, acceptance, hire, or contract |
| **Workspace** | Authorized execution context | Project, repository, inbox, or public folder |
| **Submission** | Versioned work and explanation submitted for review | Application, proposal, portfolio, draft, or proof |
| **Review rubric** | Versioned evaluation criteria | Scorecard, test, or AI prompt |
| **Review** | Human evaluation against a rubric | Verification, audit, judgment, approval, or AI analysis |
| **Proof** | Evidence record that passed defined verification rules | Resume, portfolio, certificate, endorsement, score, rating, or identity check |
| **Proof Graph** | Connected history of proof-relevant skills, evidence, reviews, projects, outcomes, and endorsements | Social graph, reputation score, contribution graph, or talent score |
| **Reputation event** | Auditable event that changes a reputation signal | Score update, badge, ranking, or popularity event |
| **Message thread** | Participant-scoped contextual conversation | Application, contract, dispute, review, or public feed |
| **Paid trial** | Bounded compensated engagement before a larger contract | Unpaid test, unpaid production task, gig, project, or contract |
| **Contract** | Versioned agreement defining parties, scope, milestones, payments, and status | Offer, application, project, message, or paid trial |
| **Milestone** | Contract acceptance unit | Task, invoice, payout, or project as a whole |
| **Payment** | Financial obligation/transfer tied to contract or milestone | Payout, fee, balance, wallet, or analytics event |
| **Payout** | Provider-mediated transfer to an eligible recipient | Payment, earning, refund, or proof reward |
| **Dispute** | Structured contested-case workflow | Report, complaint, refund, rejection, or AI flag |
| **Report** | Submitted safety/integrity/policy concern | Finding, dispute outcome, enforcement action, or proof rejection |

For implementation alignment, the data contract's `Conversation` entity is the storage identifier for the canonical domain concept **Message thread**. The API/event contract's `Engagements`, `Payments`, `Trust/Admin`, `Projects`, `Workspaces`, `Reviews`, and `Proof` boundaries are module ownership boundaries, not alternate product concepts.

## API, event, data, and PRD alignment

The domain model reconciles with the approved contracts as follows:

| Contract surface | Canonical alignment |
|---|---|
| Product/PRD language | Use talent, company member, reviewer, organization, project, challenge, application, submission, review, proof, paid trial, contract, payment, payout, dispute, and report with the definitions above. The first-release loop remains real work → human review → proof → paid opportunity. |
| Data model | Persist explicit owner/scope, visibility, lifecycle, version, retention, actor, and audit fields. Public proof references an exact submission version and review decision; private evidence remains restricted. |
| API boundaries | Identity owns session and consent; Organizations owns membership; Projects owns projects/applications; Workspaces owns submissions/access; Reviews owns assignments/rubrics/decisions; Proof owns publication/revocation/reputation; Engagements owns contract versions/milestones; Payments owns provider truth; Trust/Admin owns reports/disputes/enforcement. |
| Event families | Emit versioned, privacy-classified events in the canonical families `membership.*`, `project.*`, `application.*`, `workspace.*`, `submission.*`, `review.*`, `proof.*`, `reputation.*`, `contract.*`, `milestone.*`, `payment.*`, `payout.*`, `report.*`, and `dispute.*` only after the corresponding domain command succeeds. |
| Provider state | Provider webhooks are verified and idempotent before payment, payout, contract activation prerequisites, or reconciliation state changes. UI redirects and client claims are never state truth. |
| AI governance | AI analysis is machine assistance only. It must be labeled, source-linked, uncertainty-aware, correctable, and subordinate to a human decision; it cannot create a final domain transition for proof, hiring, payment, enforcement, dispute, reviewer approval, or account action. |

No database implementation begins before this domain model is approved. Later schema, API, event, or UI work must reference these terms and state transitions rather than inventing new synonyms.

## Scenario resolutions

| Scenario | Required domain resolution |
|---|---|
| Talent submits a revision after changes are requested | Create a new `SubmissionVersion`; transition `changes requested -> resubmitted -> under review`; preserve prior versions, feedback, and audit events. |
| Reviewer has a conflict of interest | Reviewer cannot accept or finalize the assignment; record the conflict, transition or route through `challenged`, revoke access if required, and reassign through an authorized process. |
| Company closes a project with no accepted submission | Keep organization ownership, transition through the permitted closure path with `completion_reason=no_accepted_submission` or archive before work begins, and do not create a fabricated submission, proof, or outcome. |
| Verified proof is revoked | Transition `verified -> revoked` or `published -> revoked`, remove public availability, preserve audit reference, and prevent the revoked chain from powering public proof or recommendations. |
| User leaves an organization while owning an active project | Revoke membership-derived access, retain organization ownership, preserve authorship/audit history, and require an authorized organization administrator to reassign management or restrict the project. |
| Payment succeeds but an application request is retried | Deduplicate provider event and request idempotency key; keep payment/provider state authoritative and prevent duplicate application, contract, payment, payout, or notification side effects. |
| Dispute opens after a contract is completed | Allow `completed -> disputed` when policy permits; preserve completed contract and payment history, open a linked restricted case, and resolve through auditable case/appeal transitions. |

## References and approval gate

This model is aligned to the approved internal source-of-truth contracts:

- [Master PRD](MASTER_PRD.md)
- [Product Vision](PRODUCT_VISION.md)
- [Research Evidence](RESEARCH_EVIDENCE.md)
- [Data Model Contract](DATA_MODEL_CONTRACT.md)
- [API and Event Contract](API_EVENT_CONTRACT.md)
- [Security Rules](SECURITY_RULES.md)
- [AI Governance](AI_GOVERNANCE.md)
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md)

Before Phase 05 schema or feature work begins, product, design, engineering, security, and operations owners must approve this vocabulary, the state transition tables, the provider-aware payment rules, the visibility boundaries, and the unresolved policy decisions. Approval is a gate; this document alone is not implementation evidence.
