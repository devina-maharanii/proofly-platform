/** Evidence Ledger Editorial — Phase 32 company loading state makes source and permission verification explicit before any private recommendation is rendered. */
export default function CompanyMatchingLoading() {
  return (
    <main className="matching-page" aria-busy="true" aria-live="polite">
      <header className="matching-hero">
        <p className="matching-kicker">Private company review</p>
        <h1>Checking project requirements and voluntary proof sources.</h1>
        <p>
          No talent recommendation is shown until current company permission,
          consent, proof, and project state are all confirmed.
        </p>
      </header>
    </main>
  );
}
