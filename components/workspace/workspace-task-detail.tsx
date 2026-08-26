"use client";

/** Phase 26 style: one focused private task detail with accessible bounded edits and state transitions, without a broad project-management suite. */
import Link from "next/link";
import { useActionState } from "react";

import {
  assignProjectWorkspaceTaskAction,
  transitionProjectWorkspaceTaskAction,
  updateProjectWorkspaceTaskAction,
} from "@/lib/workspace/actions";
import {
  initialWorkspaceActionState,
  workspaceTaskStateLabel,
  type WorkspaceTaskDetail,
} from "@/lib/workspace/types";

const stateOptions = [
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export function WorkspaceTaskDetailView({
  task,
}: Readonly<{ task: WorkspaceTaskDetail }>) {
  const [updateState, updateAction] = useActionState(
    updateProjectWorkspaceTaskAction,
    initialWorkspaceActionState
  );
  const [transitionState, transitionAction] = useActionState(
    transitionProjectWorkspaceTaskAction,
    initialWorkspaceActionState
  );
  const [assignmentState, assignmentAction] = useActionState(
    assignProjectWorkspaceTaskAction,
    initialWorkspaceActionState
  );
  return (
    <section className="profile-section workspace-task-detail">
      <div className="profile-section-heading">
        <p className="profile-index">Task detail</p>
        <h1>{task.title}</h1>
        <p>
          This private task carries one bounded work context. Status changes are
          recorded; they do not create a submission, review decision, payment,
          contract, or proof.
        </p>
        <Link
          className="button button-secondary"
          href={`/workspaces/${task.workspaceId}`}
        >
          Back to workspace
        </Link>
      </div>
      <dl className="workspace-review-list">
        <div>
          <dt>Current status</dt>
          <dd>{workspaceTaskStateLabel(task.state)}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{task.priority}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{task.dueDate ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Assignment</dt>
          <dd>
            {task.isAssignedToCurrentActor
              ? "Assigned to you"
              : "Participant assignment is private"}
          </dd>
        </div>
      </dl>
      {task.canEdit ? (
        <form className="workspace-submission-form" action={updateAction}>
          <input type="hidden" name="workspaceId" value={task.workspaceId} />
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="assignedUserId" value="" />
          <label>
            <span>Title</span>
            <input
              name="title"
              defaultValue={task.title}
              maxLength={160}
              required
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              name="description"
              defaultValue={task.description}
              maxLength={1000}
              rows={4}
            />
          </label>
          <label>
            <span>Priority</span>
            <select name="priority" defaultValue={task.priority}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input
              name="dueDate"
              type="date"
              defaultValue={task.dueDate ?? ""}
            />
          </label>
          <label>
            <span>Acceptance criteria</span>
            <textarea
              name="acceptanceCriteria"
              defaultValue={task.acceptanceCriteria}
              maxLength={1200}
              rows={4}
            />
          </label>
          <button className="button button-secondary" type="submit">
            Save task details
          </button>
          {updateState.status !== "idle" ? (
            <p
              className="profile-status"
              data-status={updateState.status}
              role="status"
            >
              {updateState.message}
            </p>
          ) : null}
        </form>
      ) : null}
      {task.canEdit ? (
        <form className="workspace-compact-form" action={assignmentAction}>
          <input type="hidden" name="workspaceId" value={task.workspaceId} />
          <input type="hidden" name="taskId" value={task.id} />
          <h2>Assignment</h2>
          <p>
            Assign this task only to the accepted active Talent participant. The
            server derives the participant; this form does not select a person.
          </p>
          <button className="button button-secondary" type="submit">
            Assign accepted Talent
          </button>
          {assignmentState.status !== "idle" ? (
            <p
              className="profile-status"
              data-status={assignmentState.status}
              role="status"
            >
              {assignmentState.message}
            </p>
          ) : null}
        </form>
      ) : null}
      {task.canTransition ? (
        <form className="workspace-compact-form" action={transitionAction}>
          <input type="hidden" name="workspaceId" value={task.workspaceId} />
          <input type="hidden" name="taskId" value={task.id} />
          <label>
            <span>Record a permitted status</span>
            <select name="state" defaultValue={task.state}>
              {stateOptions.map(state => (
                <option value={state} key={state}>
                  {workspaceTaskStateLabel(state)}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" type="submit">
            Record task status
          </button>
          {transitionState.status !== "idle" ? (
            <p
              className="profile-status"
              data-status={transitionState.status}
              role="status"
            >
              {transitionState.message}
            </p>
          ) : null}
        </form>
      ) : null}
      <section className="workspace-boundary-card">
        <h2>Acceptance and dependencies</h2>
        <p>
          {task.acceptanceCriteria ||
            "No additional acceptance criteria are recorded for this task."}
        </p>
        <p>
          {task.dependencyTaskIds.length
            ? `${task.dependencyTaskIds.length} private dependency reference(s) are recorded.`
            : "No dependency reference is recorded."}
        </p>
      </section>
    </section>
  );
}
