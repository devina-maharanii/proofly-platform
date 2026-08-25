# Account Settings

## Scope

Phase 14 introduces the authenticated `/settings` control surface for a person’s own account. It covers personal profile basics, privacy defaults, notification preferences, current-account security status, connected GitHub identity status, current-session controls, and request-only export or deletion rights. It does not create company billing, organization/project settings, reviewer payouts, marketplace preferences, public profiles, proof publication, or data-processing jobs.

## Ownership and privacy

`personal_settings`, `data_rights_requests`, and `account_security_events` are private records owned by the authenticated `auth.uid()`. Each table has Row-Level Security enabled and only an owner-read policy. The application does not grant direct client mutation policies; the server submits validated data through tightly scoped, authenticated self-service RPCs that derive the actor from `auth.uid()`.

Profile, portfolio, contact, membership, and discoverability choices default to private. A saved preference neither creates a public surface nor overrides a future proof, participant, organization, or retention policy. It is an explicit personal default that later authorized modules must evaluate server-side.

## Sensitive controls

Changing a password, revoking other sessions, disconnecting GitHub, requesting export, and requesting deletion each require the current password in the same server action. Passwords are used only for Supabase confirmation and are never persisted, returned, logged, or written to an audit event. GitHub may be disconnected only if another identity remains linked.

The provider can revoke other refresh-token sessions while retaining the current session. Existing access tokens may remain valid until their configured expiry, so the interface describes the limit rather than claiming an immediate universal logout. The page shows the current session and the available revoke-other-sessions action; it does not fabricate a device inventory where the provider does not expose one.

## Data rights and audit boundary

An export request records a private request for authorized processing. A deletion request records a scheduled 14-day grace period; it does not silently remove organization-owned, operationally retained, safety, or legally retained records. Processing, retention propagation, legal-hold evaluation, and export delivery remain durable background-work responsibilities, not a Phase 14 browser action.

`account_security_events` is append-only and records only the actor, an allowlisted action type, and timestamp. It contains no password, token, provider payload, request body, identity document, or private profile content. The authenticated person can review their own recent event log.
