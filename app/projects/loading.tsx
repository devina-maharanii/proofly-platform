/** Phase 23 loading: mirrors the discoverable project ledger without inventing project data or implying a result exists. */
export default function ProjectsLoading() {
  return (
    <main
      className="project-discovery-page"
      aria-busy="true"
      aria-label="Loading project discovery"
    >
      <header className="project-discovery-header">
        <span className="project-discovery-brand">
          Proofly <span>/ discovery</span>
        </span>
      </header>
      <section className="project-discovery-intro">
        <p className="profile-kicker">ASSEMBLING PUBLIC CONTEXT</p>
        <h1>Checking published project records.</h1>
        <p>Loading only public, currently available project context.</p>
      </section>
      <div className="project-discovery-skeleton search" />
      <section className="project-discovery-results">
        <div className="project-discovery-skeleton heading" />
        {[1, 2, 3].map(index => (
          <div className="project-discovery-skeleton card" key={index} />
        ))}
      </section>
    </main>
  );
}
