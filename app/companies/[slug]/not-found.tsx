import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Company context unavailable | Proofly",
  robots: { index: false, follow: false },
};

export default function CompanyProfileNotFound() {
  return (
    <main id="main-content" className="public-profile-page">
      <section className="public-profile-unavailable">
        <p className="profile-kicker">Company context unavailable</p>
        <h1>This public company page is not available.</h1>
        <p>
          It may not exist, may be hidden, or may not be available to this
          request. Proofly does not disclose which condition applies.
        </p>
        <Link className="button button-primary" href="/">
          Return to Proofly
        </Link>
      </section>
    </main>
  );
}
