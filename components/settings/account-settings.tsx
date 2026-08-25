/** Proofly Phase 14: an evidence-led, private personal-control surface with intentionally separated routine and destructive account actions. */
"use client";

import { useActionState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  changePasswordAction,
  disconnectGithubAction,
  requestDataRightAction,
  revokeOtherSessionsAction,
  saveNotificationsAction,
  savePrivacyAction,
  saveProfileAction,
} from "@/lib/settings/actions";
import {
  disconnectGithubContextAction,
  hideGithubRepositoryAction,
  refreshGithubAction,
  removeGithubRepositoryAction,
  selectGithubRepositoryAction,
} from "@/lib/github/actions";
import {
  initialSettingsFormState,
  type AccountSettingsContext,
  type SettingsFormState,
} from "@/lib/settings/types";

type FormStatusProps = Readonly<{ state: SettingsFormState }>;

function FormStatus({ state }: FormStatusProps) {
  if (state.status === "idle") return null;
  return (
    <p
      className="settings-status"
      data-status={state.status}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

function FieldError({
  state,
  name,
}: Readonly<{ state: SettingsFormState; name: string }>) {
  const message = state.fieldErrors?.[name];
  return message ? <p className="settings-field-error">{message}</p> : null;
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: Readonly<{
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}>) {
  return (
    <label className="settings-toggle">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function SecurityEventLabel({ eventType }: Readonly<{ eventType: string }>) {
  const labels: Record<string, string> = {
    "account.settings_saved": "Personal settings changed",
    "account.privacy_saved": "Privacy defaults changed",
    "account.notifications_saved": "Notification preferences changed",
    "account.password_changed": "Password changed",
    "account.sessions_revoked": "Other sessions revoked",
    "account.identity_unlinked": "Connected identity removed",
    "account.export_requested": "Personal-data export requested",
    "account.deletion_requested": "Account deletion requested",
    "account.deletion_cancelled": "Account deletion request cancelled",
  };
  return labels[eventType] ?? "Account security event";
}

export function AccountSettings({
  context,
  githubOAuthStatus = "",
}: Readonly<{ context: AccountSettingsContext; githubOAuthStatus?: string }>) {
  const [profileState, profileAction] = useActionState(
    saveProfileAction,
    initialSettingsFormState
  );
  const [privacyState, privacyAction] = useActionState(
    savePrivacyAction,
    initialSettingsFormState
  );
  const [notificationsState, notificationsAction] = useActionState(
    saveNotificationsAction,
    initialSettingsFormState
  );
  const [passwordState, passwordAction] = useActionState(
    changePasswordAction,
    initialSettingsFormState
  );
  const [sessionsState, sessionsAction] = useActionState(
    revokeOtherSessionsAction,
    initialSettingsFormState
  );
  const [githubState, githubAction] = useActionState(
    disconnectGithubAction,
    initialSettingsFormState
  );
  const [githubRefreshState, githubRefreshAction] = useActionState(
    refreshGithubAction,
    initialSettingsFormState
  );
  const [githubSelectState, githubSelectAction] = useActionState(
    selectGithubRepositoryAction,
    initialSettingsFormState
  );
  const [githubHideState, githubHideAction] = useActionState(
    hideGithubRepositoryAction,
    initialSettingsFormState
  );
  const [githubRemoveState, githubRemoveAction] = useActionState(
    removeGithubRepositoryAction,
    initialSettingsFormState
  );
  const [githubDisconnectState, githubDisconnectAction] = useActionState(
    disconnectGithubContextAction,
    initialSettingsFormState
  );
  const [rightsState, rightsAction] = useActionState(
    requestDataRightAction,
    initialSettingsFormState
  );
  const githubConnected = context.identities.some(
    identity => identity.provider === "github"
  );
  const githubOAuthMessage: Record<
    string,
    { status: "success" | "error"; message: string }
  > = {
    importing: {
      status: "success",
      message:
        "GitHub consent was recorded. The initial public-repository import is running in the background.",
    },
    denied: {
      status: "error",
      message:
        "GitHub authorization was cancelled. No GitHub context was connected.",
    },
    invalid: {
      status: "error",
      message:
        "This GitHub authorization link was expired or invalid. Start a new connection when ready.",
    },
    "configuration-unavailable": {
      status: "error",
      message: "GitHub context is not configured yet. Try again later.",
    },
    "provider-unavailable": {
      status: "error",
      message:
        "GitHub could not be reached. No public context was changed; try again later.",
    },
    "unexpected-scope": {
      status: "error",
      message:
        "GitHub returned broader access than Proofly accepts. No context was connected.",
    },
    "session-expired": {
      status: "error",
      message:
        "Your session expired before GitHub connection could begin. Sign in again to continue safely.",
    },
    "rate-limited": {
      status: "error",
      message:
        "Too many GitHub connection requests were made. Wait a moment, then try again.",
    },
  };
  const callbackState = githubOAuthMessage[githubOAuthStatus];

  return (
    <AuthShell
      eyebrow="Personal controls"
      title="Account settings"
      description="Manage your identity, privacy defaults, security, and data-rights requests. These controls apply to you, not to any organization you belong to."
    >
      <nav className="settings-nav" aria-label="Settings sections">
        <a href="#profile">Profile</a>
        <a href="#security">Security</a>
        <a href="#privacy">Privacy</a>
        <a href="#notifications">Notifications</a>
        <a href="#connections">Connections</a>
        <a href="#data-rights">Data rights</a>
      </nav>

      <section
        className="settings-section"
        id="profile"
        aria-labelledby="profile-title"
      >
        <div className="settings-heading">
          <p className="settings-index">01 / personal identity</p>
          <h2 id="profile-title">Profile basics</h2>
          <p>
            Only the visibility controls below determine whether future profile
            information can be discovered.
          </p>
        </div>
        <form action={profileAction} className="settings-form">
          <div className="settings-grid">
            <label>
              <span>Display name</span>
              <input
                name="displayName"
                defaultValue={context.settings.displayName}
                maxLength={80}
                autoComplete="name"
              />
              <FieldError state={profileState} name="displayName" />
            </label>
            <label>
              <span>Avatar URL</span>
              <input
                name="avatarUrl"
                defaultValue={context.settings.avatarUrl}
                inputMode="url"
                placeholder="https://"
              />
              <small>
                Optional HTTPS image address. Files are not uploaded here.
              </small>
              <FieldError state={profileState} name="avatarUrl" />
            </label>
            <label>
              <span>Preferred language</span>
              <select name="preferredLanguage" defaultValue="en">
                <option value="en">English</option>
              </select>
            </label>
            <label>
              <span>Timezone</span>
              <input
                name="timezone"
                defaultValue={context.settings.timezone}
                maxLength={80}
                autoComplete="off"
              />
              <FieldError state={profileState} name="timezone" />
            </label>
          </div>
          <label>
            <span>Short bio</span>
            <textarea
              name="shortBio"
              defaultValue={context.settings.shortBio}
              maxLength={280}
              rows={4}
            />
            <small>
              Optional. This does not create a public profile by itself.
            </small>
            <FieldError state={profileState} name="shortBio" />
          </label>
          <div className="settings-actions">
            <button className="button button-primary" type="submit">
              Save profile basics
            </button>
            <button className="button button-secondary" type="reset">
              Reset unsaved changes
            </button>
          </div>
          <FormStatus state={profileState} />
        </form>
      </section>

      <section
        className="settings-section"
        id="security"
        aria-labelledby="security-title"
      >
        <div className="settings-heading">
          <p className="settings-index">02 / sign-in safeguards</p>
          <h2 id="security-title">Login and security</h2>
          <p>
            Confirm your current password before a security change. Passwords
            and session tokens are never shown in your account record.
          </p>
        </div>
        <div className="settings-readout" aria-label="Security status">
          <p>
            <strong>Email</strong>
            <span>{context.email || "Unavailable"}</span>
          </p>
          <p>
            <strong>Email verification</strong>
            <span>
              {context.emailConfirmed ? "Confirmed" : "Not confirmed"}
            </span>
          </p>
          <p>
            <strong>Two-factor authentication</strong>
            <span>{context.mfaEnabled ? "Enabled" : "Not enabled"}</span>
          </p>
          <p>
            <strong>Current session</strong>
            <span>This browser is signed in.</span>
          </p>
        </div>
        <div className="settings-split">
          <form
            action={passwordAction}
            className="settings-form settings-subsection"
          >
            <h3>Change password</h3>
            <label>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <FieldError state={passwordState} name="currentPassword" />
            </label>
            <label>
              <span>New password</span>
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
              />
              <FieldError state={passwordState} name="newPassword" />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
              />
              <FieldError state={passwordState} name="confirmPassword" />
            </label>
            <button className="button button-primary" type="submit">
              Change password
            </button>
            <FormStatus state={passwordState} />
          </form>
          <form
            action={sessionsAction}
            className="settings-form settings-subsection"
          >
            <h3>Active sessions</h3>
            <p className="settings-copy">
              This device is active. Other devices are not enumerated by the
              authentication provider, but you can revoke every other
              refresh-token session while keeping this session open.
            </p>
            <label>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <FieldError state={sessionsState} name="currentPassword" />
            </label>
            <button className="button button-secondary" type="submit">
              Sign out other sessions
            </button>
            <FormStatus state={sessionsState} />
          </form>
        </div>
        <div className="settings-event-log" aria-labelledby="event-log-title">
          <h3 id="event-log-title">Recent security activity</h3>
          {context.securityEvents.length ? (
            <ol>
              {context.securityEvents.map(event => (
                <li key={event.id}>
                  <span>
                    {SecurityEventLabel({ eventType: event.eventType })}
                  </span>
                  <time dateTime={event.occurredAt}>
                    {new Date(event.occurredAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="settings-copy">
              No security changes have been recorded yet.
            </p>
          )}
        </div>
      </section>

      <section
        className="settings-section"
        id="privacy"
        aria-labelledby="privacy-title"
      >
        <div className="settings-heading">
          <p className="settings-index">03 / visibility boundary</p>
          <h2 id="privacy-title">Privacy and visibility</h2>
          <p>
            Every control defaults to private. Saved preferences are enforced on
            the server and do not publish existing records.
          </p>
        </div>
        <form action={privacyAction} className="settings-form">
          <div className="settings-grid">
            <label>
              <span>Profile visibility</span>
              <select
                name="profileVisibility"
                defaultValue={context.settings.profileVisibility}
              >
                <option value="private">Private</option>
                <option value="public">Public when available</option>
              </select>
            </label>
            <label>
              <span>Proof visibility default</span>
              <select
                name="proofVisibilityDefault"
                defaultValue={context.settings.proofVisibilityDefault}
              >
                <option value="private">Private</option>
                <option value="restricted">
                  Restricted to authorized participants
                </option>
              </select>
            </label>
            <label>
              <span>Portfolio visibility</span>
              <select
                name="portfolioVisibility"
                defaultValue={context.settings.portfolioVisibility}
              >
                <option value="private">Private</option>
                <option value="public">Public when available</option>
              </select>
            </label>
            <label>
              <span>Contact visibility</span>
              <select
                name="contactVisibility"
                defaultValue={context.settings.contactVisibility}
              >
                <option value="private">Private</option>
                <option value="public">Public when available</option>
              </select>
            </label>
            <label>
              <span>Company membership visibility</span>
              <select
                name="membershipVisibility"
                defaultValue={context.settings.membershipVisibility}
              >
                <option value="private">Private</option>
                <option value="public">Public when available</option>
              </select>
            </label>
          </div>
          <Toggle
            name="searchDiscoverability"
            label="Search discoverability"
            description="Permit approved future discovery surfaces to consider your visible profile."
            defaultChecked={context.settings.searchDiscoverability}
          />
          <Toggle
            name="dataSharing"
            label="Optional data sharing"
            description="Allow only approved privacy-safe product improvement measurement; this is never evidence or a trust score."
            defaultChecked={context.settings.dataSharing}
          />
          <div className="settings-actions">
            <button className="button button-primary" type="submit">
              Save privacy defaults
            </button>
            <button className="button button-secondary" type="reset">
              Reset unsaved changes
            </button>
          </div>
          <FormStatus state={privacyState} />
        </form>
      </section>

      <section
        className="settings-section"
        id="notifications"
        aria-labelledby="notifications-title"
      >
        <div className="settings-heading">
          <p className="settings-index">04 / delivery preferences</p>
          <h2 id="notifications-title">Notifications</h2>
          <p>
            Choose how Proofly may deliver approved account and product updates.
          </p>
        </div>
        <form action={notificationsAction} className="settings-form">
          <Toggle
            name="email"
            label="Email notifications"
            description="Allow delivery to the email associated with your account."
            defaultChecked={context.settings.notifications.email}
          />
          <Toggle
            name="inApp"
            label="In-app notifications"
            description="Allow account notices inside authenticated Proofly surfaces."
            defaultChecked={context.settings.notifications.inApp}
          />
          <Toggle
            name="projectUpdates"
            label="Project updates"
            description="Receive updates for future authorized project participation."
            defaultChecked={context.settings.notifications.projectUpdates}
          />
          <Toggle
            name="reviewUpdates"
            label="Review updates"
            description="Receive updates for future authorized review activity."
            defaultChecked={context.settings.notifications.reviewUpdates}
          />
          <Toggle
            name="hiringMessages"
            label="Hiring messages"
            description="Receive messages only if a future authorized conversation exists."
            defaultChecked={context.settings.notifications.hiringMessages}
          />
          <Toggle
            name="paymentUpdates"
            label="Payment updates"
            description="Receive provider-verified updates if payments are later enabled."
            defaultChecked={context.settings.notifications.paymentUpdates}
          />
          <Toggle
            name="marketing"
            label="Marketing communications"
            description="Receive optional product communications. This is off by default."
            defaultChecked={context.settings.notifications.marketing}
          />
          <div className="settings-actions">
            <button className="button button-primary" type="submit">
              Save notification preferences
            </button>
            <button className="button button-secondary" type="reset">
              Reset unsaved changes
            </button>
          </div>
          <FormStatus state={notificationsState} />
        </form>
      </section>

      <section
        className="settings-section"
        id="connections"
        aria-labelledby="connections-title"
      >
        <div className="settings-heading">
          <p className="settings-index">05 / connected accounts and context</p>
          <h2 id="connections-title">Connected accounts</h2>
          <p>
            A sign-in identity and imported GitHub context are separate. GitHub
            activity is contextual information, not verified Proofly evidence or
            an automatic skill assessment.
          </p>
        </div>
        <div className="settings-readout">
          <p>
            <strong>GitHub sign-in identity</strong>
            <span>{githubConnected ? "Connected" : "Not connected"}</span>
          </p>
        </div>
        {githubConnected ? (
          <form action={githubAction} className="settings-form settings-danger">
            <h3>Disconnect GitHub</h3>
            <p className="settings-copy">
              This removes GitHub as a sign-in method. It is allowed only when
              another sign-in identity remains connected.
            </p>
            <label>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <FieldError state={githubState} name="currentPassword" />
            </label>
            <button className="button button-danger" type="submit">
              Disconnect GitHub
            </button>
            <FormStatus state={githubState} />
          </form>
        ) : (
          <p className="settings-copy">
            No GitHub sign-in identity is currently connected.
          </p>
        )}

        <div className="github-context-panel">
          <div className="github-context-heading">
            <div>
              <p className="settings-index">GitHub / optional work context</p>
              <h3>Selected public GitHub work</h3>
            </div>
            <span
              className="github-context-status"
              data-status={context.github.status ?? "not-connected"}
            >
              {context.github.status
                ? context.github.status.replaceAll("_", " ")
                : "not connected"}
            </span>
          </div>
          {!context.activeTalentContext ? (
            <div className="github-context-empty">
              <p>
                GitHub work context is available only while a Talent context is
                active. It is separate from any connected sign-in identity.
              </p>
            </div>
          ) : !context.github.connected ? (
            <div className="github-context-empty">
              <p>
                Connect only public GitHub profile and repository context.
                Proofly does not request private repositories or write access.
                You choose each repository that may appear on your public Talent
                profile.
              </p>
              {callbackState ? (
                <p
                  className="settings-status"
                  data-status={callbackState.status}
                  role="status"
                >
                  {callbackState.message}
                </p>
              ) : null}
              <a className="button button-primary" href="/api/github/connect">
                Connect GitHub context
              </a>
              <p className="settings-copy">
                Imported activity is never verified proof, a reputation score,
                or an employment claim.
              </p>
            </div>
          ) : (
            <>
              {callbackState ? (
                <p
                  className="settings-status"
                  data-status={callbackState.status}
                  role="status"
                >
                  {callbackState.message}
                </p>
              ) : null}
              <dl className="github-context-meta">
                <div>
                  <dt>Connected account</dt>
                  <dd>
                    {context.github.profileUrl ? (
                      <a href={context.github.profileUrl} rel="noreferrer">
                        @{context.github.username}
                      </a>
                    ) : (
                      `@${context.github.username}`
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Last synchronized</dt>
                  <dd>
                    {context.github.lastSyncedAt
                      ? new Date(context.github.lastSyncedAt).toLocaleString()
                      : "Import in progress"}
                  </dd>
                </div>
                <div>
                  <dt>Source status</dt>
                  <dd>Contextual · not verified</dd>
                </div>
              </dl>
              {context.github.retryAfterAt ? (
                <p
                  className="settings-status"
                  data-status="error"
                  role="status"
                >
                  GitHub limited requests. Refresh is available again after{" "}
                  {new Date(context.github.retryAfterAt).toLocaleString()}.
                </p>
              ) : null}
              <form
                action={githubRefreshAction}
                className="settings-form github-refresh-form"
              >
                <p className="settings-copy">
                  Refresh checks the public repository snapshot again. It does
                  not publish new repositories automatically.
                </p>
                <button className="button button-secondary" type="submit">
                  Refresh GitHub context
                </button>
                <FormStatus state={githubRefreshState} />
              </form>
              <div className="github-context-repositories">
                <div>
                  <h4>Imported public repositories</h4>
                  <p className="settings-copy">
                    Select a repository to show it as source-labelled context on
                    your public profile. Hide or remove it at any time.
                  </p>
                </div>
                {context.github.repositories.length ? (
                  <ul className="github-context-list">
                    {context.github.repositories.map(repository => (
                      <li key={repository.id}>
                        <div>
                          <a href={repository.sourceUrl} rel="noreferrer">
                            {repository.fullName}
                          </a>
                          <span>
                            {repository.selectedPublic
                              ? "Selected publicly · contextual only"
                              : "Private to you · not selected"}
                          </span>
                          {repository.description ? (
                            <p>{repository.description}</p>
                          ) : null}
                          <small>{repository.contributionContext}</small>
                        </div>
                        <div className="github-context-actions">
                          {repository.selectedPublic ? (
                            <form action={githubHideAction}>
                              <input
                                type="hidden"
                                name="repositoryId"
                                value={repository.id}
                              />
                              <button
                                className="button button-secondary"
                                type="submit"
                              >
                                Hide
                              </button>
                            </form>
                          ) : (
                            <form action={githubSelectAction}>
                              <input
                                type="hidden"
                                name="repositoryId"
                                value={repository.id}
                              />
                              <button
                                className="button button-secondary"
                                type="submit"
                              >
                                Select publicly
                              </button>
                            </form>
                          )}
                          <form action={githubRemoveAction}>
                            <input
                              type="hidden"
                              name="repositoryId"
                              value={repository.id}
                            />
                            <button
                              className="button button-danger"
                              type="submit"
                            >
                              Remove imported data
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="settings-copy">
                    No public repository snapshot is available yet. Wait for the
                    current import or refresh manually later.
                  </p>
                )}
                <FormStatus state={githubSelectState} />
                <FormStatus state={githubHideState} />
                <FormStatus state={githubRemoveState} />
              </div>
              <form
                action={githubDisconnectAction}
                className="settings-form settings-danger"
              >
                <h4>Disconnect GitHub work context</h4>
                <p className="settings-copy">
                  This revokes future GitHub access, removes stored provider
                  tokens, removes imported repositories, and immediately removes
                  selected GitHub context from your public profile. It does not
                  affect a separately connected GitHub sign-in identity.
                </p>
                <label>
                  <span>Type DISCONNECT to confirm</span>
                  <input name="confirmation" autoComplete="off" required />
                </label>
                <button className="button button-danger" type="submit">
                  Disconnect GitHub context
                </button>
                <FormStatus state={githubDisconnectState} />
              </form>
            </>
          )}
        </div>
      </section>

      <section
        className="settings-section settings-section-danger"
        id="data-rights"
        aria-labelledby="rights-title"
      >
        <div className="settings-heading">
          <p className="settings-index">06 / data rights</p>
          <h2 id="rights-title">Export or delete your account</h2>
          <p>
            These requests are deliberate. A deletion request has a 14-day grace
            period and never silently deletes organization-owned or retained
            operational records.
          </p>
        </div>
        <div className="settings-split">
          <form
            action={rightsAction}
            className="settings-form settings-subsection"
          >
            <h3>Request personal-data export</h3>
            <p className="settings-copy">
              The request is recorded for authorized processing. Do not include
              personal data in the request.
            </p>
            <input type="hidden" name="requestType" value="export" />
            <label>
              <span>Type REQUEST to confirm</span>
              <input name="confirmation" required pattern="REQUEST" />
            </label>
            <label>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button button-secondary" type="submit">
              Request export
            </button>
          </form>
          <form
            action={rightsAction}
            className="settings-form settings-subsection settings-danger"
          >
            <h3>Request account deletion</h3>
            <p className="settings-copy">
              Your request schedules a reversible 14-day grace period.
              Processing must preserve records subject to organization,
              operational, legal, or safety retention.
            </p>
            <input type="hidden" name="requestType" value="deletion" />
            <label>
              <span>Type REQUEST to confirm</span>
              <input name="confirmation" required pattern="REQUEST" />
            </label>
            <label>
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button button-danger" type="submit">
              Request deletion
            </button>
          </form>
        </div>
        <FormStatus state={rightsState} />
        {context.dataRightsRequests.length ? (
          <div className="settings-event-log">
            <h3>Recorded requests</h3>
            <ol>
              {context.dataRightsRequests.map(request => (
                <li key={request.id}>
                  <span>
                    {request.requestType === "export"
                      ? "Personal-data export"
                      : "Account deletion"}
                    : {request.status}
                  </span>
                  <time dateTime={request.requestedAt}>
                    {new Date(request.requestedAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </AuthShell>
  );
}
