"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="error-shell">
      <p className="eyebrow">A recoverable loading error</p>
      <h1>We could not load this proof context.</h1>
      <p>
        Nothing has been changed. Try again to reload the public explanation.
      </p>
      <button type="button" className="button button-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
