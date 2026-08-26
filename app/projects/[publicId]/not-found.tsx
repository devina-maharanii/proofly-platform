/** Phase 22 unavailable state: direct Project/Challenge URLs fail closed and do not reveal whether a record is draft, restricted, closed, archived, or absent. */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Project context unavailable | Proofly",
  robots: { index: false, follow: false },
};

export default function PublicProjectNotFound() {
  return (
    <main id="main-content" className="public-profile-page">
      <section className="public-profile-unavailable">
        <p className="profile-kicker">Project context unavailable</p>
        <h1>This project page is not available.</h1>
        <p>
          It may not exist, may be private, may not be published, or may not be
          available to this request. Proofly does not disclose which condition
          applies.
        </p>
        <Link className="button button-primary" href="/">
          Return to Proofly
        </Link>
      </section>
    </main>
  );
}
