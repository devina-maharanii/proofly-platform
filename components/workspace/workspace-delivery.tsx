"use client";

/** Phase 26 style: calm, participant-scoped work delivery with bounded task controls, private artifact versions, explicit submission preview, and no review decisions, chat, payment, execution, or AI. */
import Link from "next/link";
import type { Route } from "next";
import { useActionState } from "react";

import {
  createProjectWorkspaceTaskAction,
  saveProjectWorkspaceSubmissionAction,
  submitProjectWorkspaceSubmissionAction,
  uploadProjectWorkspaceFileAction,
} from "@/lib/workspace/actions";
import {
  initialWorkspaceActionState,
  workspaceTaskStateLabel,
  type WorkspaceFile,
  type WorkspaceSubmission,
  type WorkspaceTask,
} from "@/lib/workspace/types";

const fileSize = (value: number) =>
  value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;

const statusMessage = (state: { status: string; message: string }) =>
  state.status === "idle" ? null : (
    <p className="profile-status" data-status={state.status} role="status">
      {state.message}
    </p>
  );

function TaskCreate({
  workspaceId,
  canManage,
}: Readonly<{ workspaceId: string; canManage: boolean }>) {
  const [state, action] = useActionState(
    createProjectWorkspaceTaskAction,
    initialWorkspaceActionState
  );
  if (!canManage) return null;
  return (
    <form className="workspace-compact-form" action={action}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <h3>Add a bounded task</h3>
      <label>
        <span>Title</span>
        <input name="title" required maxLength={160} />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" maxLength={1000} rows={3} />
      </label>
      <label>
        <span>Priority</span>
        <select name="priority" defaultValue="normal">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        <span>Due date (optional)</span>
        <input name="dueDate" type="date" />
      </label>
      <label>
        <span>Acceptance criteria</span>
        <textarea name="acceptanceCriteria" maxLength={1200} rows={3} />
      </label>
      <button className="button button-secondary" type="submit">
        Add task
      </button>
      {statusMessage(state)}
    </form>
  );
}

function TaskList({
  workspaceId,
  tasks,
  canManage,
}: Readonly<{
  workspaceId: string;
  tasks: WorkspaceTask[];
  canManage: boolean;
}>) {
  return (
    <>
      {tasks.length ? (
        <ol className="workspace-task-list">
          {tasks.map(task => (
            <li key={task.id}>
              <div>
                <h3>
                  <Link
                    href={
                      `/workspaces/${workspaceId}/tasks/${task.id}` as Route
                    }
                  >
                    {task.title}
                  </Link>
                </h3>
                <p>
                  {task.description || "No additional task boundary recorded."}
                </p>
                <span>
                  {task.isAssignedToCurrentActor
                    ? "Assigned to you"
                    : "Participant assignment is private."}
                </span>
              </div>
              <span className="profile-state-badge">
                {workspaceTaskStateLabel(task.state)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="profile-empty-copy">
          No task is recorded yet. The project deliverable and acceptance
          criteria remain visible above.
        </p>
      )}
      <TaskCreate workspaceId={workspaceId} canManage={canManage} />
    </>
  );
}

function FileUpload({
  workspaceId,
  canUpload,
}: Readonly<{ workspaceId: string; canUpload: boolean }>) {
  const [state, action, isPending] = useActionState(
    uploadProjectWorkspaceFileAction,
    initialWorkspaceActionState
  );
  if (!canUpload)
    return (
      <p className="profile-empty-copy">
        Only active Talent or authorized company participants can add private
        artifacts in this workspace.
      </p>
    );
  return (
    <form
      className="workspace-compact-form"
      action={action}
      encType="multipart/form-data"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <h3>Upload a private artifact</h3>
      <p>
        PDF, JPEG, PNG, WebP, or plain text only; maximum 10 MB. The server
        validates content and ownership before the file is available.
      </p>
      <label>
        <span>Display name</span>
        <input name="displayName" maxLength={180} required />
      </label>
      <label>
        <span>Description (optional)</span>
        <input name="description" maxLength={600} />
      </label>
      <label>
        <span>File</span>
        <input
          name="file"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
        />
      </label>
      <button
        className="button button-secondary"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Uploading and validating…" : "Upload private file"}
      </button>
      {isPending ? (
        <p className="profile-status" data-status="idle" role="status">
          Uploading through the private workspace boundary. Keep this page open
          while the artifact is validated.
        </p>
      ) : (
        statusMessage(state)
      )}
    </form>
  );
}

function FileList({
  workspaceId,
  files,
}: Readonly<{ workspaceId: string; files: WorkspaceFile[] }>) {
  return (
    <div className="workspace-files">
      <h3>Private artifacts</h3>
      {files.length ? (
        <ul>
          {files.map(file => (
            <li key={file.id}>
              <div>
                <strong>{file.displayName}</strong>
                <span>
                  {file.description || "No description"}
                  {file.isOwnedByCurrentActor ? " · Your artifact" : ""}
                </span>
              </div>
              <ol>
                {file.versions.map(version => (
                  <li key={version.id}>
                    <span>
                      v{version.versionNumber} · {version.originalFilename} ·{" "}
                      {fileSize(version.sizeBytes)} · {version.scanState}
                    </span>
                    {version.canDownload ? (
                      <a
                        href={`/workspaces/${workspaceId}/files/${version.id}`}
                      >
                        Download
                      </a>
                    ) : (
                      <span>
                        Unavailable until private validation completes
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-empty-copy">
          No private artifact has been uploaded in this workspace.
        </p>
      )}
    </div>
  );
}

function SubmissionEditor({
  workspaceId,
  tasks,
  files,
  submission,
  canCreate,
}: Readonly<{
  workspaceId: string;
  tasks: WorkspaceTask[];
  files: WorkspaceFile[];
  submission: WorkspaceSubmission | null;
  canCreate: boolean;
}>) {
  const [saveState, saveAction, savePending] = useActionState(
    saveProjectWorkspaceSubmissionAction,
    initialWorkspaceActionState
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitProjectWorkspaceSubmissionAction,
    initialWorkspaceActionState
  );
  if (!canCreate && !submission)
    return (
      <p className="profile-empty-copy">
        Only the active Talent participant can create a private submission
        package.
      </p>
    );
  const current =
    submission?.versions.find(
      version => version.versionNumber === submission.currentVersionNumber
    ) ?? submission?.versions[0];
  const editable = canCreate && (!submission || submission.canEdit);
  return (
    <div className="workspace-submission">
      <h3>Versioned submission package</h3>
      <p>
        Preview the same bounded package a later authorized reviewer may
        receive. Saving a draft does not submit it, create proof, or produce a
        review decision.
      </p>
      {editable ? (
        <form className="workspace-submission-form" action={saveAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <label>
            <span>Related task (optional)</span>
            <select name="taskId" defaultValue={submission?.taskId ?? ""}>
              <option value="">No task selected</option>
              {tasks.map(task => (
                <option value={task.id} key={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Summary</span>
            <textarea
              name="summary"
              defaultValue={current?.summary ?? ""}
              maxLength={1000}
              rows={3}
              required
            />
          </label>
          <label>
            <span>Problem interpretation</span>
            <textarea
              name="problemInterpretation"
              defaultValue={current?.problemInterpretation ?? ""}
              maxLength={1400}
              rows={4}
              required
            />
          </label>
          <label>
            <span>Approach and decisions</span>
            <textarea
              name="approachAndDecisions"
              defaultValue={current?.approachAndDecisions ?? ""}
              maxLength={1800}
              rows={5}
              required
            />
          </label>
          <label>
            <span>Deliverables</span>
            <textarea
              name="deliverables"
              defaultValue={current?.deliverables ?? ""}
              maxLength={1400}
              rows={4}
              required
            />
          </label>
          <label>
            <span>Demo or repository link (optional)</span>
            <input
              name="demoOrRepositoryLink"
              type="url"
              defaultValue={current?.demoOrRepositoryLink ?? ""}
            />
          </label>
          <label>
            <span>Known limitations</span>
            <textarea
              name="knownLimitations"
              defaultValue={current?.knownLimitations ?? ""}
              maxLength={1400}
              rows={3}
            />
          </label>
          <label>
            <span>Time spent or completion context</span>
            <textarea
              name="completionContext"
              defaultValue={current?.completionContext ?? ""}
              maxLength={700}
              rows={3}
              required
            />
          </label>
          <fieldset>
            <legend>Supporting private files</legend>
            {files
              .filter(file => file.isOwnedByCurrentActor)
              .flatMap(file =>
                file.versions
                  .filter(version => version.scanState === "clean")
                  .map(version => (
                    <label key={version.id}>
                      <input
                        type="checkbox"
                        name="fileVersionIds"
                        value={version.id}
                        defaultChecked={current?.files.some(
                          fileVersion => fileVersion.id === version.id
                        )}
                      />
                      {file.displayName} · v{version.versionNumber}
                    </label>
                  ))
              )}
          </fieldset>
          <label>
            <input
              type="checkbox"
              name="ownershipConfirmed"
              value="confirmed"
              defaultChecked={current?.ownershipConfirmed}
            />{" "}
            I confirm I own this work or have stated the required attribution.
          </label>
          <label>
            <input
              type="checkbox"
              name="attributionConfirmed"
              value="confirmed"
              defaultChecked={current?.attributionConfirmed}
            />{" "}
            I confirm the submission does not misrepresent third-party work.
          </label>
          <button
            className="button button-secondary"
            type="submit"
            disabled={savePending}
          >
            {savePending ? "Saving private draft…" : "Save private draft"}
          </button>
          {savePending ? (
            <p className="profile-status" data-status="idle" role="status">
              Saving the current private package without sending it for review.
            </p>
          ) : (
            statusMessage(saveState)
          )}
        </form>
      ) : null}
      {submission &&
      (submission.state === "draft" ||
        submission.state === "changes_requested") ? (
        <form className="workspace-submit-form" action={submitAction}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="submissionId" value={submission.id} />
          <h4>Pre-submit checklist</h4>
          <ul>
            <li>Required written context is complete.</li>
            <li>At least one clean private file is attached.</li>
            <li>Ownership and attribution are confirmed.</li>
            <li>
              The preview below is the package later reviewers can receive.
            </li>
          </ul>
          <button
            className="button button-primary"
            type="submit"
            disabled={submitPending}
          >
            {submitPending
              ? "Recording submission…"
              : `Submit version ${submission.currentVersionNumber}`}
          </button>
          {submitPending ? (
            <p className="profile-status" data-status="idle" role="status">
              Recording this immutable package; no review decision is being
              made.
            </p>
          ) : (
            statusMessage(submitState)
          )}
        </form>
      ) : null}
      {submission ? (
        <div className="workspace-submission-preview">
          <h4>
            Private package preview · {submission.state.replaceAll("_", " ")}
          </h4>
          {submission.versions.map(version => (
            <article key={version.id}>
              <h5>Version {version.versionNumber}</h5>
              <p>
                <strong>Summary:</strong> {version.summary || "Not recorded"}
              </p>
              <p>
                <strong>Approach:</strong>{" "}
                {version.approachAndDecisions || "Not recorded"}
              </p>
              <p>
                <strong>Deliverables:</strong>{" "}
                {version.deliverables || "Not recorded"}
              </p>
              <p>
                <strong>Files:</strong>{" "}
                {version.files.length
                  ? version.files
                      .map(file => `${file.displayName} v${file.versionNumber}`)
                      .join(", ")
                  : "None"}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceDelivery({
  workspaceId,
  tasks,
  files,
  submission,
  canManageTasks,
  canUploadFiles,
  canCreateSubmission,
}: Readonly<{
  workspaceId: string;
  tasks: WorkspaceTask[];
  files: WorkspaceFile[];
  submission: WorkspaceSubmission | null;
  canManageTasks: boolean;
  canUploadFiles: boolean;
  canCreateSubmission: boolean;
}>) {
  return (
    <section className="profile-section" id="work">
      <div className="profile-section-heading">
        <p className="profile-index">02 · Work</p>
        <h2>Tasks, private artifacts, and submission versions</h2>
        <p>
          Keep work bounded to the visible project context. Private artifacts
          remain participant-scoped; a submitted version is ready for a later
          human review, not an approval or proof.
        </p>
      </div>
      <TaskList
        workspaceId={workspaceId}
        tasks={tasks}
        canManage={canManageTasks}
      />
      <div className="workspace-delivery-grid">
        <div>
          <FileUpload workspaceId={workspaceId} canUpload={canUploadFiles} />
          <FileList workspaceId={workspaceId} files={files} />
        </div>
        <SubmissionEditor
          workspaceId={workspaceId}
          tasks={tasks}
          files={files}
          submission={submission}
          canCreate={canCreateSubmission}
        />
      </div>
    </section>
  );
}
