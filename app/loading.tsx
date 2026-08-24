export default function Loading() {
  return (
    <main
      className="page-shell loading-shell"
      aria-busy="true"
      aria-label="Loading Proofly"
      role="status"
    >
      <div className="loading-rule" />
      <p className="eyebrow">Loading the proof chain</p>
      <div className="loading-title" />
      <div className="loading-copy" />
      <div className="loading-copy loading-copy-short" />
    </main>
  );
}
