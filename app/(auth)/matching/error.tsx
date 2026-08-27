"use client";

/** Evidence Ledger Editorial — Phase 32 failure state is direct about unavailable source checks and does not present stale recommendations. */
export default function TalentMatchingError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <main className="matching-page">
      <header className="matching-hero">
        <p className="matching-kicker">Matching temporarily unavailable</p>
        <h1>Current sources could not be rechecked.</h1>
        <p>
          No recommendation is shown when proof, consent, or project context
          cannot be verified. Your profile, Proof, and application records are
          unchanged.
        </p>
        <button
          className="matching-button matching-button-primary"
          type="button"
          onClick={reset}
        >
          Try source check again
        </button>
      </header>
    </main>
  );
}
