/* Evidence Ledger Editorial: unavailable records resolve to a quiet, bounded document state without exposing private evidence details. */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Work evidence not found | Proofly",
  robots: { index: false, follow: false },
};

export default function PublicWorkEvidenceNotFound() {
  return (
    <main id="main-content" className="public-evidence-page" tabIndex={-1}>
      <section
        className="public-evidence-content"
        aria-labelledby="evidence-not-found-title"
      >
        <article className="public-evidence-not-found">
          <p className="profile-kicker">Evidence availability</p>
          <h1 id="evidence-not-found-title">This work record is unavailable</h1>
          <p>
            The link may be private, archived, no longer shared, or incorrect.
            Proofly does not reveal private work records through public links.
          </p>
          <Link className="button button-primary" href="/">
            Return to Proofly
          </Link>
        </article>
      </section>
    </main>
  );
}
