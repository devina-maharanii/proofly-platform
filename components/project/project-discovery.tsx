"use client";

/** Phase 23 style: dense but calm evidence-led project discovery; filters and ranking are inspectable, while saving is a talent-owned private preference rather than an application signal. */
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  recordRecentProjectSearchAction,
  toggleSavedProjectAction,
} from "@/lib/project/actions";
import {
  activeDiscoveryFilterCount,
  emptyProjectDiscoveryFilters,
  parseProjectDiscoverySearchParams,
  projectDiscoveryQueryString,
  type ProjectDiscoveryUrlState,
} from "@/lib/project/discovery";
import {
  compensationStatuses,
  initialProjectSaveActionState,
  projectDiscoveryDeadlines,
  projectDiscoverySorts,
  projectDiscoveryTimeboxes,
  projectDiscoveryWorkModes,
  projectTypeLabel,
  type ProjectDiscoveryItem,
  type RecentProjectSearch,
} from "@/lib/project/types";
import {
  canonicalSkillFamilies,
  canonicalSkillLabel,
  canonicalSkills,
  talentClaimLevels,
} from "@/lib/profile/types";

type DiscoveryProps = Readonly<{
  filters: ProjectDiscoveryUrlState;
  items: ProjectDiscoveryItem[];
  nextCursor: string | null;
  rateLimitedForSeconds: number | null;
  savedProjectIds: readonly string[];
  recentSearches: readonly RecentProjectSearch[];
  canSave: boolean;
}>;

function compensationLabel(status: ProjectDiscoveryItem["compensationStatus"]) {
  if (status === "paid_defined") return "Paid context stated";
  if (status === "unpaid_evaluation") return "Unpaid evaluation only";
  return "Paid terms to be agreed";
}

function deadlineLabel(value: string, timezoneOverlap: string) {
  return value
    ? `Deadline date: ${value} · ${timezoneOverlap ? `organization overlap: ${timezoneOverlap}` : "organization timezone not specified"} · date only`
    : "Deadline date unavailable";
}

function removeFilter(
  filters: ProjectDiscoveryUrlState,
  key: keyof ProjectDiscoveryUrlState
) {
  return projectDiscoveryQueryString({
    ...filters,
    [key]:
      emptyProjectDiscoveryFilters[
        key as keyof typeof emptyProjectDiscoveryFilters
      ] ?? "",
  });
}

function activeFilters(filters: ProjectDiscoveryUrlState) {
  return [
    ["query", filters.query, `Search: ${filters.query}`],
    [
      "skill",
      filters.skill,
      filters.skill ? canonicalSkillLabel(filters.skill) : "",
    ],
    ["skillFamily", filters.skillFamily, filters.skillFamily],
    ["skillLevelContext", filters.skillLevelContext, filters.skillLevelContext],
    [
      "projectType",
      filters.projectType,
      filters.projectType ? projectTypeLabel(filters.projectType) : "",
    ],
    ["timebox", filters.timebox, filters.timebox.replaceAll("_", " ")],
    [
      "compensation",
      filters.compensation,
      filters.compensation.replaceAll("_", " "),
    ],
    [
      "workMode",
      filters.workMode === "any" ? "" : filters.workMode,
      filters.workMode,
    ],
    ["timezone", filters.timezone, `Timezone: ${filters.timezone}`],
    [
      "deadline",
      filters.deadline === "any" ? "" : filters.deadline,
      filters.deadline.replaceAll("_", " "),
    ],
    ["companySize", filters.companySize, `Company: ${filters.companySize}`],
    ["sort", filters.sort === "relevance" ? "" : filters.sort, filters.sort],
  ] as const;
}

export function ProjectSaveControl({
  publicId,
  initiallySaved,
  canSave,
}: Readonly<{ publicId: string; initiallySaved: boolean; canSave: boolean }>) {
  const [state, action, pending] = useActionState(
    toggleSavedProjectAction,
    initialProjectSaveActionState
  );
  const saved =
    state.status === "success" ? state.saved === true : initiallySaved;
  if (!canSave) {
    return (
      <a
        className="project-discovery-save project-discovery-save-link"
        href={`/sign-in?next=/projects/${publicId}`}
      >
        Sign in to save
      </a>
    );
  }
  return (
    <form action={action} className="project-discovery-save-form">
      <input type="hidden" name="publicId" value={publicId} />
      <button
        className="project-discovery-save"
        type="submit"
        aria-pressed={saved}
        disabled={pending}
      >
        {pending ? "Saving…" : saved ? "Saved" : "Save project"}
      </button>
      {state.status === "error" ? (
        <p className="project-discovery-form-error" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ProjectDiscoveryForm({
  filters,
  canSave,
}: Readonly<{ filters: ProjectDiscoveryUrlState; canSave: boolean }>) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = activeDiscoveryFilterCount(filters);

  return (
    <form
      action="/projects"
      method="get"
      className="project-discovery-form"
      onSubmit={event => {
        if (canSave) {
          const nextFilters = parseProjectDiscoverySearchParams(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >
          );
          const { cursor: _cursor, ...recordableFilters } = nextFilters;
          void _cursor;
          void recordRecentProjectSearchAction(
            nextFilters.query,
            recordableFilters
          );
        }
      }}
    >
      <div className="project-discovery-search-row">
        <label
          className="project-discovery-query-label"
          htmlFor="project-query"
        >
          Search published project context
        </label>
        <div className="project-discovery-query-control">
          <input
            id="project-query"
            name="q"
            type="search"
            defaultValue={filters.query}
            maxLength={160}
            placeholder="React accessibility, API design, testing…"
          />
          <button type="submit">Search</button>
        </div>
      </div>
      <button
        className="project-discovery-filter-toggle"
        type="button"
        aria-expanded={filtersOpen}
        aria-controls="project-discovery-filters"
        onClick={() => setFiltersOpen(current => !current)}
      >
        {filtersOpen ? "Hide filters" : "Show filters"}
        {filterCount ? ` · ${filterCount} active` : ""}
      </button>
      <div
        id="project-discovery-filters"
        className={`project-discovery-filters ${filtersOpen ? "is-open" : ""}`}
      >
        <label>
          Skill
          <select name="skill" defaultValue={filters.skill}>
            <option value="">Any governed skill</option>
            {canonicalSkills.map(skill => (
              <option key={skill.key} value={skill.key}>
                {skill.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Skill family
          <select name="family" defaultValue={filters.skillFamily}>
            <option value="">Any family</option>
            {canonicalSkillFamilies.map(family => (
              <option key={family.key} value={family.key}>
                {family.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level context
          <select name="level" defaultValue={filters.skillLevelContext}>
            <option value="">Any stated context</option>
            {talentClaimLevels.map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project type
          <select name="type" defaultValue={filters.projectType}>
            <option value="">Any public type</option>
            <option value="public_challenge">Public challenge</option>
            <option value="portfolio_prompt">Portfolio prompt</option>
            <option value="hiring_evaluation">Hiring evaluation</option>
            <option value="future_paid_trial">Future paid-trial project</option>
          </select>
        </label>
        <label>
          Timebox
          <select name="timebox" defaultValue={filters.timebox}>
            <option value="">Any timebox</option>
            {projectDiscoveryTimeboxes.map(value => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Compensation
          <select name="compensation" defaultValue={filters.compensation}>
            <option value="">Any compensation label</option>
            {compensationStatuses.map(value => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Work mode
          <select name="mode" defaultValue={filters.workMode}>
            {projectDiscoveryWorkModes.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Timezone overlap
          <input
            name="timezone"
            defaultValue={filters.timezone}
            maxLength={80}
            placeholder="e.g. UTC"
          />
        </label>
        <label>
          Deadline
          <select name="deadline" defaultValue={filters.deadline}>
            {projectDiscoveryDeadlines.map(value => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Company size
          <input
            name="company"
            defaultValue={filters.companySize}
            maxLength={80}
            placeholder="e.g. 1–10"
          />
        </label>
        <label>
          Order
          <select name="sort" defaultValue={filters.sort}>
            {projectDiscoverySorts.map(value => (
              <option key={value} value={value}>
                {value === "relevance"
                  ? "Relevance then freshness"
                  : "Recently updated"}
              </option>
            ))}
          </select>
        </label>
        {filters.savedOnly ? (
          <input type="hidden" name="saved" value="1" />
        ) : null}
        <div className="project-discovery-filter-actions">
          <button type="submit">Apply filters</button>
          <a href={filters.savedOnly ? "/projects?saved=1" : "/projects"}>
            Clear filters
          </a>
        </div>
      </div>
    </form>
  );
}

function ResultCard({
  project,
  saved,
  canSave,
}: Readonly<{
  project: ProjectDiscoveryItem;
  saved: boolean;
  canSave: boolean;
}>) {
  return (
    <article className="project-discovery-card">
      <div className="project-discovery-card-topline">
        <div>
          <p className="profile-kicker">{project.organizationName}</p>
          <h2>
            <a href={`/projects/${project.publicId}`}>{project.title}</a>
          </h2>
        </div>
        <ProjectSaveControl
          publicId={project.publicId}
          initiallySaved={saved}
          canSave={canSave}
        />
      </div>
      <p className="project-discovery-goal">{project.oneSentenceGoal}</p>
      <dl className="project-discovery-facts">
        <div>
          <dt>Type</dt>
          <dd>{projectTypeLabel(project.projectType)}</dd>
        </div>
        <div>
          <dt>Timebox</dt>
          <dd>{project.timeboxHours} hours</dd>
        </div>
        <div>
          <dt>Compensation</dt>
          <dd>{compensationLabel(project.compensationStatus)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{project.state.replaceAll("_", " ")}</dd>
        </div>
      </dl>
      <ul className="project-discovery-skills" aria-label="Required skills">
        {project.requiredSkills.slice(0, 4).map(skill => (
          <li key={skill}>{canonicalSkillLabel(skill)}</li>
        ))}
      </ul>
      <div className="project-discovery-terms">
        <p>
          <strong>
            {deadlineLabel(
              project.applicationDeadline,
              project.timezoneOverlap
            )}
          </strong>
        </p>
        <p>
          <strong>Ownership:</strong> {project.ownershipTerms}
        </p>
        <p>
          <strong>Experience context:</strong> {project.experienceContext}
        </p>
      </div>
      <div className="project-discovery-reasons">
        <span>Why this appears</span>
        <ul>
          {project.matchReasons.map(reason => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function ProjectDiscovery({
  filters,
  items,
  nextCursor,
  rateLimitedForSeconds,
  savedProjectIds,
  recentSearches,
  canSave,
}: DiscoveryProps) {
  const active = activeFilters(filters).filter(([, value]) => Boolean(value));
  const nextPath = nextCursor
    ? projectDiscoveryQueryString(filters, nextCursor)
    : null;
  return (
    <main className="project-discovery-page">
      <header className="project-discovery-header">
        <Link href="/" className="project-discovery-brand">
          Proofly <span>/ discovery</span>
        </Link>
        <p>
          Public project context only. Ranking uses your visible query, filters,
          relevance, and freshness—never popularity or a talent score.
        </p>
      </header>
      <section
        className="project-discovery-intro"
        aria-labelledby="project-discovery-heading"
      >
        <p className="profile-kicker">FIND BOUNDED WORK CONTEXT</p>
        <h1 id="project-discovery-heading">
          Read the terms before you decide what to explore.
        </h1>
        <p>
          Search published projects by stated context. Compensation, ownership,
          timebox, evaluation, and deadline terms remain visible before any
          future participation step.
        </p>
      </section>
      <ProjectDiscoveryForm filters={filters} canSave={canSave} />
      {active.length > 0 ? (
        <nav
          className="project-discovery-active-filters"
          aria-label="Active search filters"
        >
          {active.map(([key, , label]) => (
            <a key={key} href={removeFilter(filters, key)}>
              {label} <span aria-hidden="true">×</span>
            </a>
          ))}
        </nav>
      ) : null}
      {canSave && recentSearches.length > 0 ? (
        <aside
          className="project-discovery-recent"
          aria-label="Recent searches"
        >
          <span>Recent searches</span>
          {recentSearches.map((search, index) => (
            <a
              key={`${search.query}-${search.lastUsedAt ?? index}`}
              href={projectDiscoveryQueryString({
                ...emptyProjectDiscoveryFilters,
                ...search.filters,
                query: search.query,
              })}
            >
              {search.query || "Filtered project search"}
            </a>
          ))}
        </aside>
      ) : null}
      <section
        className="project-discovery-results"
        aria-live="polite"
        aria-labelledby="project-results-heading"
      >
        <div className="project-discovery-results-header">
          <div>
            <p className="profile-kicker">RESULTS</p>
            <h2 id="project-results-heading">
              {filters.savedOnly
                ? "Saved public projects"
                : "Published project context"}
            </h2>
          </div>
          {filters.savedOnly && !canSave ? (
            <a href="/sign-in?next=/projects?saved=1">
              Sign in to view saved projects
            </a>
          ) : null}
        </div>
        {rateLimitedForSeconds ? (
          <div
            className="project-discovery-message project-discovery-error"
            role="alert"
          >
            <h3>Search temporarily paused</h3>
            <p>
              Try again in about {rateLimitedForSeconds} seconds. Your URL
              filters are preserved.
            </p>
            <a href={projectDiscoveryQueryString(filters)}>Retry this search</a>
          </div>
        ) : items.length === 0 ? (
          <div className="project-discovery-message">
            <h3>
              {filters.savedOnly
                ? "No saved projects are currently available"
                : "No published projects match these terms"}
            </h3>
            <p>
              {filters.savedOnly
                ? "Saved projects that are paused, closed, private, or past their deadline are not shown here."
                : "Broaden one filter or clear the search to inspect currently published context."}
            </p>
            {/* The managed typed-route manifest can lag a newly created App Router route; this remains a static internal navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/projects">Explore all published projects</a>
          </div>
        ) : (
          <div className="project-discovery-list">
            {items.map(project => (
              <ResultCard
                key={project.publicId}
                project={project}
                saved={savedProjectIds.includes(project.publicId)}
                canSave={canSave}
              />
            ))}
          </div>
        )}
        {nextPath ? (
          <a className="project-discovery-more" href={nextPath}>
            Show more matching project context
          </a>
        ) : null}
      </section>
    </main>
  );
}
