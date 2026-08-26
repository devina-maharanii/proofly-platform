/** Phase 22 loading state: the direct Project/Challenge route keeps Proofly’s evidence rail visible while context is being checked, without implying access or participation. */
export default function PublicProjectLoading() {
  return (
    <main
      className="project-context-loading"
      aria-busy="true"
      aria-label="Assembling project context"
      role="status"
    >
      <header className="project-context-loading-brand" aria-label="Proofly">
        <span className="project-context-loading-marker" aria-hidden="true">
          <i />
        </span>
        <span>Proofly</span>
        <span>/ project context</span>
      </header>
      <section className="project-context-loading-content">
        <p className="profile-kicker">DIRECT CONTEXT CHECK</p>
        <h1>Assembling source, review, and provenance context.</h1>
        <p>
          Checking the project record’s published state and visibility boundary
          before showing any context.
        </p>
        <ol
          className="project-context-loading-rail"
          aria-label="Project context checks"
        >
          <li>
            <span>01</span>
            <div>
              <strong>Source</strong>
              <small>Organization-provided project record</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>State</strong>
              <small>Published visibility is checked first</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Privacy boundary</strong>
              <small>Private and unavailable records remain undisclosed</small>
            </div>
          </li>
        </ol>
      </section>
    </main>
  );
}
