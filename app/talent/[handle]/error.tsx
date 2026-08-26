"use client";

/** Phase 20 style: temporary failures stay neutral and never disclose profile existence. */
export default function PublicTalentProfileError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <main id="main-content" className="public-profile-page">
      <section className="public-profile-unavailable" role="alert">
        <p className="profile-kicker">Public profile</p>
        <h1>This profile is temporarily unavailable.</h1>
        <p>
          Nothing has changed. Try again to reload the public evidence profile.
        </p>
        <button type="button" className="button button-primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
