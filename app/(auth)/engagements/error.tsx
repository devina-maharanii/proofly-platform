"use client";

/** Phase 33 Evidence Ledger Editorial error state: a calm recovery route that does not expose private terms or system diagnostics. */
export default function EngagementsError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-main">
        <div className="auth-card">
          <p className="auth-evidence-stamp">
            <span aria-hidden="true">●</span> private record · unavailable
          </p>
          <div className="auth-card-header">
            <h2>This private engagement record is unavailable</h2>
            <p>
              Refresh the view or return to your authorized context. No
              contract, payment, access, or dispute action was changed.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
