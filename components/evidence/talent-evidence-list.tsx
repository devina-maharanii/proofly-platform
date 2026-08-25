import Link from "next/link";
import type { Route } from "next";

import {
  workEvidenceStateLabel,
  workEvidenceTypeLabel,
  type WorkEvidence,
} from "@/lib/evidence/types";

export function TalentEvidenceList({
  evidence,
}: Readonly<{ evidence: WorkEvidence[] }>) {
  return (
    <section
      className="profile-section evidence-list"
      aria-labelledby="evidence-list-title"
    >
      <div className="profile-section-heading evidence-list-heading">
        <div>
          <p className="profile-kicker">Work evidence</p>
          <h2 id="evidence-list-title">Your manual work records</h2>
          <p>
            Each draft, visibility state, and version is separate from
            verification or reputation.
          </p>
        </div>
        <Link
          className="button button-primary"
          href={"/profile/evidence/new" as Route}
        >
          Add evidence
        </Link>
      </div>
      {evidence.length ? (
        <ul className="evidence-owner-list">
          {evidence.map(item => (
            <li key={item.id}>
              <div>
                <p className="profile-index">
                  {workEvidenceTypeLabel(item.evidenceType)}
                </p>
                <h3>{item.title || "Untitled work evidence"}</h3>
                <p>
                  {item.shortSummary ||
                    "Add a concise summary to make this work scannable."}
                </p>
                <small>
                  {item.userRole || "Role not added"} · v{item.version}
                </small>
              </div>
              <div className="evidence-owner-actions">
                <span className="profile-state-badge">
                  {workEvidenceStateLabel(item.state)}
                </span>
                <a
                  className="button button-secondary"
                  href={`/profile/evidence/${item.id}`}
                >
                  Edit
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="profile-empty-state">
          <strong>No work evidence yet</strong>
          <p>
            Add a structured record for real work. It starts private and never
            becomes verified proof automatically.
          </p>
        </div>
      )}
    </section>
  );
}
