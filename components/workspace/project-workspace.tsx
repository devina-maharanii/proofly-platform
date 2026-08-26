"use client";

/** Phase 25 style: a calm, dense precision-editorial private workspace that keeps project brief, state, limits, and one safe next action visible without simulating messaging, file storage, submissions, review decisions, contracts, payments, or AI tools. */
import { useActionState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { transitionProjectWorkspaceAction } from "@/lib/workspace/actions";
import {
  initialWorkspaceActionState,
  workspaceRoleLabel,
  workspaceStateLabel,
  workspaceTaskStateLabel,
  workspaceTransitions,
  type ProjectWorkspace,
} from "@/lib/workspace/types";

const dateText = (value: string | null) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

const activityLabel = (eventType: string) =>
  (
    ({
      "workspace.created": "Workspace created",
      "workspace.state_changed": "Workspace state changed",
      "workspace.member_granted": "Participant access granted",
      "workspace.member_removed": "Participant access removed",
      "workspace.member_reactivated": "Participant access restored",
      "workspace.task_created": "Task created from a project milestone",
      "workspace.task_changed": "Task state changed",
      "workspace.file_event": "File event recorded",
      "workspace.submission_event": "Submission event recorded",
    }) as Record<string, string>
  )[eventType] ?? "Workspace event";

function StateControl({
  workspace,
}: Readonly<{ workspace: ProjectWorkspace }>) {
  const [state, action] = useActionState(
    transitionProjectWorkspaceAction,
    initialWorkspaceActionState
  );
  const nextStates = workspaceTransitions[workspace.state];
  if (!workspace.permissions.canChangeState || nextStates.length === 0) {
    return null;
  }
  return (
    <form className="workspace-state-control" action={action}>
      <input type="hidden" name="workspaceId" value={workspace.id} />
      <label>
        <span>Record the next workspace state</span>
        <select name="requestedState" defaultValue={nextStates[0]}>
          {nextStates.map(nextState => (
            <option key={nextState} value={nextState}>
              {workspaceStateLabel(nextState)}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-primary" type="submit">
        Record state change
      </button>
      {state.status !== "idle" ? (
        <p className="profile-status" data-status={state.status} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function NextAction({ workspace }: Readonly<{ workspace: ProjectWorkspace }>) {
  const byState = {
    preparing: {
      title: "Confirm the execution context",
      body: "Review the project brief, participant roles, and work boundaries before the workspace moves to active.",
      link: "#overview",
    },
    active: {
      title: "Work from the visible project context",
      body: "Use the task list to understand the bounded work. Creating or submitting work is not enabled in this workspace shell.",
      link: "#work",
    },
    paused: {
      title: "Wait for an authorized state change",
      body: "The project brief remains readable, but active work should not proceed while the workspace is paused.",
      link: "#overview",
    },
    awaiting_submission: {
      title: "Prepare the required work",
      body: "The expected format is visible below. Submission creation is intentionally deferred to the approved submissions phase.",
      link: "#work",
    },
    under_review: {
      title: "Keep review context visible",
      body: "The review context names the expected criteria and revision policy. No reviewer decision or scoring control exists here.",
      link: "#review",
    },
    completed: {
      title: "Read the recorded completion state",
      body: "Completion is a workspace record only. It does not create proof, a contract, payment, or an employment outcome.",
      link: "#activity",
    },
    closed: {
      title: "Use this as a retained private record",
      body: "The workspace is closed. Authorized participants can still read its bounded project and audit context.",
      link: "#activity",
    },
  } as const;
  const action = byState[workspace.state];
  return (
    <aside className="workspace-next-action" aria-label="Next action">
      <p className="profile-kicker">Next action</p>
      <h2>{action.title}</h2>
      <p>{action.body}</p>
      <a className="button button-secondary" href={action.link}>
        Open relevant context
      </a>
    </aside>
  );
}

export function ProjectWorkspaceView({
  workspace,
}: Readonly<{ workspace: ProjectWorkspace }>) {
  return (
    <AuthShell
      eyebrow="Project workspace"
      title={workspace.project.title}
      description="A private, participant-scoped execution context. It keeps the original project brief visible without granting access to files, submissions, review decisions, messaging, contracts, payments, or AI tools."
    >
      <nav
        className="profile-nav workspace-nav"
        aria-label="Workspace sections"
      >
        <a href="#overview">Overview</a>
        <a href="#work">Work</a>
        <a href="#review">Review context</a>
        <a href="#activity">Activity</a>
      </nav>
      <div className="workspace-layout">
        <main className="workspace-main">
          <section className="workspace-summary" aria-label="Workspace status">
            <div>
              <p className="profile-kicker">Current state</p>
              <h2>{workspaceStateLabel(workspace.state)}</h2>
            </div>
            <dl>
              <div>
                <dt>Access</dt>
                <dd>{workspaceRoleLabel(workspace.accessRole)}</dd>
              </div>
              <div>
                <dt>Deadline timezone</dt>
                <dd>{workspace.deadlineTimezone}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{dateText(workspace.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="profile-section" id="overview">
            <div className="profile-section-heading">
              <p className="profile-index">01 · Overview</p>
              <h2>Original project context stays visible</h2>
              <p>
                This workspace carries the approved scope forward. It does not
                replace the project brief or create new terms.
              </p>
            </div>
            <div className="workspace-brief-grid">
              <article>
                <h3>Goal</h3>
                <p>
                  {workspace.project.oneSentenceGoal || "Goal not recorded."}
                </p>
              </article>
              <article>
                <h3>Timebox</h3>
                <p>
                  {workspace.project.timeboxHours
                    ? `${workspace.project.timeboxHours} hours`
                    : "Timebox not recorded."}
                </p>
              </article>
              <article>
                <h3>Deadline</h3>
                <p>
                  {workspace.project.applicationDeadline || "Not recorded"} ·{" "}
                  {workspace.deadlineTimezone}
                </p>
              </article>
              <article>
                <h3>Expected contribution</h3>
                <p>{workspace.project.expectedRole || "Not recorded."}</p>
              </article>
            </div>
            <div className="workspace-context-copy">
              <h3>Context</h3>
              <p>
                {workspace.project.contextAndProblem || "Context not recorded."}
              </p>
              <h3>Deliverable</h3>
              <p>
                {workspace.project.requiredOutput ||
                  "Required output not recorded."}
              </p>
              <h3>Acceptance criteria</h3>
              <p>
                {workspace.project.acceptanceCriteria ||
                  "Criteria not recorded."}
              </p>
            </div>
            <div className="workspace-participants">
              <h3>Participants</h3>
              {workspace.participants.length ? (
                <ul>
                  {workspace.participants.map((participant, index) => (
                    <li key={`${participant.role}-${index}`}>
                      <strong>{workspaceRoleLabel(participant.role)}</strong>
                      <span>
                        {participant.status === "active"
                          ? "Active access"
                          : "Removed"}
                        {participant.isCurrentActor ? " · You" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="profile-empty-copy">
                  No participant role is available in this private workspace.
                </p>
              )}
            </div>
            <StateControl workspace={workspace} />
          </section>

          <section className="profile-section" id="work">
            <div className="profile-section-heading">
              <p className="profile-index">02 · Work</p>
              <h2>Task and delivery entry points</h2>
              <p>
                Project milestones appear as structured task context. Task
                edits, file uploads, external links, and submission creation
                remain deliberately unavailable until their approved phases.
              </p>
            </div>
            {workspace.tasks.length ? (
              <ol className="workspace-task-list">
                {workspace.tasks.map(task => (
                  <li key={task.id}>
                    <div>
                      <h3>{task.title}</h3>
                      <p>
                        {task.description ||
                          "No additional task boundary recorded."}
                      </p>
                    </div>
                    <span className="profile-state-badge">
                      {workspaceTaskStateLabel(task.state)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="profile-empty-copy">
                No milestone task is recorded yet. The original deliverable and
                acceptance criteria remain above.
              </p>
            )}
            <div className="workspace-entry-grid">
              <article>
                <p className="profile-kicker">Submission entry</p>
                <h3>Not enabled in this workspace shell</h3>
                <p>
                  Required format:{" "}
                  {workspace.project.submissionFormat || "Not recorded"}. A
                  submission is not created by a note, link, or client claim.
                </p>
              </article>
              <article>
                <p className="profile-kicker">Files and external links</p>
                <h3>Private access is not enabled</h3>
                <p>
                  No project file or external-link record is exposed here. This
                  avoids publishing private work before a secure file contract
                  exists.
                </p>
              </article>
            </div>
          </section>

          <section className="profile-section" id="review">
            <div className="profile-section-heading">
              <p className="profile-index">03 · Review context</p>
              <h2>Evaluation remains contextual and human-led</h2>
              <p>
                These criteria explain the work context only. This page has no
                reviewer assignment, score, feedback, decision, or AI review
                tool.
              </p>
            </div>
            <dl className="workspace-review-list">
              <div>
                <dt>Review method</dt>
                <dd>
                  {workspace.reviewContext.reviewMethod || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Revision policy</dt>
                <dd>
                  {workspace.reviewContext.revisionPolicy || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Review state</dt>
                <dd>{workspace.reviewContext.reviewState}</dd>
              </div>
            </dl>
            {workspace.reviewContext.evaluationDimensions.length ? (
              <ul className="workspace-dimensions">
                {workspace.reviewContext.evaluationDimensions.map(dimension => (
                  <li key={dimension.criterion}>
                    <strong>{dimension.criterion}</strong>
                    <span>{dimension.priority}% stated priority</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-empty-copy">
                No evaluation dimensions are available in this workspace record.
              </p>
            )}
          </section>

          <section className="profile-section" id="activity">
            <div className="profile-section-heading">
              <p className="profile-index">04 · Activity</p>
              <h2>Private state and access record</h2>
              <p>
                Activity records meaningful workspace changes. It is not a chat
                transcript and never exposes private file or submission content.
              </p>
            </div>
            {workspace.activity.length ? (
              <ol className="workspace-activity-list">
                {workspace.activity.map((event, index) => (
                  <li key={`${event.eventType}-${event.occurredAt}-${index}`}>
                    <strong>{activityLabel(event.eventType)}</strong>
                    <span>
                      {event.previousState && event.nextState
                        ? `${workspaceStateLabel(event.previousState)} → ${workspaceStateLabel(event.nextState)} · `
                        : ""}
                      {dateText(event.occurredAt)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="profile-empty-copy">
                No workspace activity has been recorded yet.
              </p>
            )}
          </section>
        </main>
        <aside className="workspace-aside">
          <NextAction workspace={workspace} />
          <section className="profile-checklist workspace-boundary-card">
            <p className="profile-kicker">Privacy and scope</p>
            <h2>Participant context only</h2>
            <p>
              Access is checked again on every private read. Removed
              participants no longer receive workspace data. Private files
              remain unavailable.
            </p>
            <p>
              This workspace does not decide hiring, approve proof, create a
              contract, move money, or make an automated decision.
            </p>
          </section>
        </aside>
      </div>
    </AuthShell>
  );
}
