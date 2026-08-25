# Phase 12 Role and Organization Permission Matrix

## Scope

This contract implements **explicit context**, not a dashboard or entitlement to future features. A Person may hold several approved capabilities, but each request uses one server-derived active context. The browser never supplies a trusted role, organization, or permission.

| Context        | Origin                                                  | Organization scope        | Current Phase 12 permitted action                   | Explicitly not granted                              |
| -------------- | ------------------------------------------------------- | ------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Talent         | Authenticated person selects their own personal context | None                      | Enter the role-neutral onboarding handoff           | Reviewer, organization, or administrator permission |
| Company member | Active approved organization membership                 | One selected organization | Read its approved membership context and select it  | Cross-organization access; ownership by default     |
| Reviewer       | Administrator-approved reviewer capability              | None                      | Select reviewer context after approval              | Self-approval; self-review; final decisions by AI   |
| Administrator  | Controlled administrator grant with audit event         | None                      | Select an elevated context after a controlled grant | Self-assignment; RLS bypass; unaudited actions      |

## Organization membership permissions

| Membership permission | Organization-scoped future command boundary                             | Phase 12 behavior                                                                                         |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Owner                 | Membership, organization settings, projects, billing, deletion requests | May view membership context; server authorization recognizes every listed organization command boundary.  |
| Hiring member         | Projects, talent evidence review, shortlist, hiring workflows           | May view membership context; authorization recognizes hiring commands only.                               |
| Reviewer member       | Eligible company reviews                                                | May view membership context; authorization recognizes review participation only when separately eligible. |
| Billing member        | Payment methods, invoices, subscription state                           | May view membership context; authorization recognizes billing commands only.                              |
| Viewer                | Permitted company reads                                                 | May view membership context; no mutations, review, or billing authority.                                  |

## Enforcement rules

Every organization lookup uses the authenticated actor and server-derived active membership. Server authorization checks exact context, membership status, and required permission before a future command runs. Supabase Row-Level Security separately limits rows to an active member, current person, or explicit administrator policy. `reviewer` and `administrator` capability requests cannot grant access from a client form: reviewer access remains pending until an audited administrator resolution, while administrator access is granted only by an already elevated administrator through a controlled server-side path.

The initial administrator is a **deployment security bootstrap**, not a product action: it must be inserted through a restricted operational migration or Supabase security-console procedure with a documented approver and audit record. The public application has no bootstrap or self-selection mechanism for administrator access.

## Onboarding handoff

`/auth/continue` presents the safe next context. A person can select Talent, select one approved organization membership, or request reviewer access. It intentionally does not create a profile, project, payment, review, or administrator capability. The next role-specific workspace is deferred to its approved phase.
