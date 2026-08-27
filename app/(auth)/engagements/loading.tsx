/** Phase 33 Evidence Ledger Editorial loading state: a quiet private record placeholder with no implied engagement facts. */
export default function EngagementsLoading() {
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-main">
        <div className="auth-card" aria-busy="true">
          <p className="auth-evidence-stamp">
            <span aria-hidden="true">●</span> private record · loading
          </p>
          <div className="auth-card-header">
            <h2>Loading private engagement records</h2>
            <p>
              Proofly is checking the verified session and authorized
              participant context.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
