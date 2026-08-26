/** Phase 20 style: a calm, non-disclosing unavailable profile state. */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Profile unavailable | Proofly",
  robots: { index: false, follow: false },
};

export default function PublicTalentProfileNotFound() {
  return (
    <main id="main-content" className="public-profile-page">
      <section className="public-profile-unavailable">
        <p className="profile-kicker">Public profile</p>
        <h1>This profile is unavailable.</h1>
        <p>
          It may be hidden, still private, no longer shared, or the address may
          be incorrect.
        </p>
        <Link className="button button-primary" href="/">
          Return to Proofly
        </Link>
      </section>
    </main>
  );
}
