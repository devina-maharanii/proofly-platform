/** Evidence Ledger Editorial: the masthead uses a compact proof-marker glyph and deliberately typeset ledger-style wordmark. */

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand-mark" href="#top" aria-label="Proofly home">
      <span className="brand-glyph" aria-hidden="true" />
      {!compact ? (
        <span className="brand-wordmark">
          <span>Proofly</span>
          <em>/ evidence</em>
        </span>
      ) : null}
    </a>
  );
}
