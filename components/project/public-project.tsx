/** Phase 22 style: public Project/Challenge pages are evidence-led project records, not a job board, application funnel, invitation flow, messaging surface, contract, or payment promise. */
import Link from "next/link";

import { canonicalSkillLabel } from "@/lib/profile/types";
import {
  projectStateLabel,
  projectTypeLabel,
  type PublicProject,
} from "@/lib/project/types";

function CompensationCopy({ project }: Readonly<{ project: PublicProject }>) {
  if (project.compensationStatus === "paid_defined") {
    return "Paid context is explicitly stated by the organization. Payment execution and amounts are not processed or represented on this page.";
  }
  if (project.compensationStatus === "paid_to_be_agreed") {
    return "The organization states paid compensation is to be agreed. This page does not establish payment terms, a contract, or a commitment.";
  }
  return "This is an unpaid evaluation exercise only. The organization states that work cannot be reused as production output or transferred as ownership.";
}

export function PublicProjectView({
  project,
}: Readonly<{ project: PublicProject }>) {
  const paused = project.state === "paused";
  return (
    <main className="public-profile-page public-project-page">
      <header className="public-profile-header">
        <Link href="/">Proofly</Link>
        <span>Project context record</span>
      </header>
      <article className="public-profile-content public-project-content">
        <section className="public-profile-intro project-public-intro">
          <div className="public-profile-intro-topline">
            <div>
              <p className="profile-kicker">
                {paused
                  ? "Paused project context"
                  : "Published project context"}
              </p>
              <p className="project-public-organization">
                {project.organizationName}
              </p>
              <h1>{project.title}</h1>
            </div>
            <span className="profile-state-badge">
              {projectStateLabel(project.state)}
            </span>
          </div>
          <p className="public-profile-headline">{project.oneSentenceGoal}</p>
          <dl className="public-profile-intro-data project-public-summary">
            <div>
              <dt>Project type</dt>
              <dd>{projectTypeLabel(project.projectType)}</dd>
            </div>
            <div>
              <dt>Work purpose</dt>
              <dd>{project.workPurpose.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Timebox</dt>
              <dd>{project.timeboxHours} hours</dd>
            </div>
            <div>
              <dt>Participant limit</dt>
              <dd>{project.participantLimit}</dd>
            </div>
          </dl>
          {paused ? (
            <p className="project-paused-note">
              This project is paused. The direct page remains as context only
              and does not indicate active participation.
            </p>
          ) : null}
        </section>

        <div className="public-profile-primary">
          <section className="public-profile-section project-public-section">
            <p className="profile-kicker">Problem and scope</p>
            <h2>What the work is for</h2>
            <p className="project-public-copy">{project.contextAndProblem}</p>
            <div className="project-public-detail-grid">
              <div>
                <h3>Why it matters</h3>
                <p>{project.whyItMatters}</p>
              </div>
              <div>
                <h3>Expected contribution</h3>
                <p>{project.expectedRole}</p>
              </div>
              <div>
                <h3>Experience context</h3>
                <p>{project.experienceContext}</p>
              </div>
              <div>
                <h3>Explicitly out of scope</h3>
                <p>{project.outOfScope}</p>
              </div>
            </div>
          </section>

          <section className="public-profile-section project-public-section">
            <p className="profile-kicker">Deliverables</p>
            <h2>What a bounded output includes</h2>
            <dl className="company-public-detail-list">
              <div>
                <dt>Required output</dt>
                <dd>{project.requiredOutput}</dd>
              </div>
              <div>
                <dt>Acceptance criteria</dt>
                <dd>{project.acceptanceCriteria}</dd>
              </div>
              <div>
                <dt>Submission format</dt>
                <dd>{project.submissionFormat}</dd>
              </div>
            </dl>
            {project.milestones.length > 0 ? (
              <ol className="project-public-milestones">
                {project.milestones.map(milestone => (
                  <li key={`${milestone.name}-${milestone.description}`}>
                    <strong>{milestone.name}</strong>
                    <span>{milestone.description}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section className="public-profile-section project-public-section project-public-evaluation">
            <p className="profile-kicker">Evaluation context</p>
            <h2>How the organization says it will evaluate</h2>
            {project.rubricSetup === "defined" ? (
              <ul className="project-public-dimensions">
                {project.evaluationDimensions.map(dimension => (
                  <li key={dimension.criterion}>
                    <span>{dimension.criterion}</span>
                    <strong>{dimension.priority}% priority</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="project-public-copy">
                The organization has explicitly marked detailed rubric setup for
                a later approved stage. It does not imply automated, opaque, or
                final decision-making.
              </p>
            )}
            <dl className="company-public-detail-list">
              <div>
                <dt>Review method</dt>
                <dd>{project.reviewMethod}</dd>
              </div>
              <div>
                <dt>Reviewer expectations</dt>
                <dd>{project.reviewerExpectations}</dd>
              </div>
              <div>
                <dt>Revision policy</dt>
                <dd>{project.revisionPolicy}</dd>
              </div>
              <div>
                <dt>Decision timeline</dt>
                <dd>{project.decisionTimeline}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="public-profile-secondary">
          <section className="public-profile-section project-public-skills">
            <p className="profile-kicker">Skill context</p>
            <h2>Governed, not inferred</h2>
            <h3>Required</h3>
            <ul className="company-public-tags">
              {project.requiredSkills.map(skill => (
                <li key={skill}>{canonicalSkillLabel(skill)}</li>
              ))}
            </ul>
            {project.helpfulSkills.length > 0 ? (
              <>
                <h3>Helpful</h3>
                <ul className="company-public-tags">
                  {project.helpfulSkills.map(skill => (
                    <li key={skill}>{canonicalSkillLabel(skill)}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="profile-proof-boundary">
              These are project-specific requirements. They do not establish a
              person’s skill, eligibility, rank, or verified proof.
            </p>
          </section>

          <section className="public-profile-section project-public-fairness">
            <p className="profile-kicker">Fairness terms</p>
            <h2>What is explicit before participation</h2>
            <dl className="company-public-detail-list">
              <div>
                <dt>Compensation</dt>
                <dd>
                  <CompensationCopy project={project} />
                </dd>
              </div>
              <div>
                <dt>Ownership and IP</dt>
                <dd>{project.ownershipTerms}</dd>
              </div>
              <div>
                <dt>Data and access</dt>
                <dd>{project.dataAccessRestrictions}</dd>
              </div>
              <div>
                <dt>Participant expectations</dt>
                <dd>{project.participantExpectations}</dd>
              </div>
              <div>
                <dt>Expected response time</dt>
                <dd>{project.expectedResponseTime}</dd>
              </div>
              <div>
                <dt>Participation deadline</dt>
                <dd>{project.applicationDeadline}</dd>
              </div>
            </dl>
            {project.workPurpose === "evaluation_exercise" ? (
              <p className="profile-proof-boundary">
                <strong>Evaluation safeguard:</strong> this project is framed as
                an evaluation exercise. The organization states that output is
                not for production reuse or ownership transfer.
              </p>
            ) : null}
          </section>

          <section className="public-profile-section company-public-boundary">
            <p className="profile-kicker">Scope boundary</p>
            <h2>This page does not enable participation</h2>
            <p>
              It is a direct project context record. It does not accept
              applications, issue or accept invitations, offer messaging,
              provide a workspace, take a submission, assign a reviewer, form a
              contract, process payment, or make a hiring decision or response
              guarantee.
            </p>
          </section>
        </aside>
      </article>
    </main>
  );
}
