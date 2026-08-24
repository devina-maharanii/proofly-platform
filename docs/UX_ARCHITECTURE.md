# Proofly Public Marketing UX Architecture

## Scope and conversion principle

This document defines the public marketing website experience for Proofly before implementation. It covers public information architecture, page goals, section order, calls to action, responsive behavior, SEO and sharing requirements, and trust/proof messaging. It does not authorize authenticated dashboards, marketplace logic, project-management behavior, hiring decisions, payment flows, reviewer operations, or fake social proof.

The public site should let a visitor understand Proofly, choose the correct role path, and reach the appropriate signup action without a sales call or product demo. The primary audience order is **junior and early-career software developers**, **startup founders and engineering leads**, then **experienced practitioners who may become reviewers**. In canonical audience terms, the order is: **Junior and early-career software developers**, **Startup founders and engineering leads**, and **Experienced practitioners who may become reviewers**. The site must feel premium without hiding information and must make verification and privacy understandable before asking for trust.

## Public sitemap

| Route | Public goal | Primary audience | Primary CTA | Secondary navigation |
|---|---|---|---|---|
| `/` | Explain what Proofly is, why real work needs context, and which role path to choose. | Mixed public audience, with talent first | `Build your proof` | `Hire from evidence`, `How it works`, `How verification works` |
| `/for-talent` | Show how talent turns real software work into reviewable proof and a trusted opportunity path. | Junior and early-career software developers | `Build your proof` | `How verification works`, `How it works` |
| `/for-companies` | Show how startups and small product teams inspect relevant evidence before human hiring judgment and start a fair paid trial. | Founders and engineering leads | `Hire from evidence` | `How verification works`, `How it works` |
| `/how-it-works` | Explain the full proof-to-opportunity loop from bounded work through review, proof, and paid opportunity. | All three roles | Contextual role CTA after explanation | `Build your proof`, `Hire from evidence`, `Become a reviewer` |
| `/verification` | Explain qualified human review, rubrics, conflicts, revision requests, revocation, privacy, and limits. | Talent first; companies and reviewers | Contextual role CTA after trust explanation | `Build your proof`, `Become a reviewer` |
| `/pricing` | Explain validated public pricing only when pricing, economics, market, and payment policy are approved. | Companies and reviewers where applicable | Contextual signup action only after approval | No route should expose unapproved pricing. |
| `/sign-in` | Let an existing account sign in and recover access without marketing distraction. | Existing users | `Sign in` | `Get started` |
| `/get-started` | Let a visitor choose a role and enter the correct signup path with clear expectations. | New visitors | Role-specific CTA | `Sign in`, public explanation pages |

`/pricing` is reserved behind an approval gate. Until pricing is validated and approved for the enabled market, it must not appear as a public promise, placeholder, or invented number. Public navigation may use `For companies`, `How it works`, and `How verification works` as direct route labels; no navigation item should imply that a feature or market is already live when it is not.

### Navigation and route rules

Desktop navigation stays on one line where the viewport allows. The public header prioritizes the Proofly working name, `For talent`, `For companies`, `How it works`, `Verification`, `Sign in`, and one `Get started` action. The header must not become a dense product dashboard, expose authenticated navigation, or use multiple visually equivalent primary CTAs.

Each route has one primary user goal and one primary CTA intent. Repeated labels may appear in separate page sections only when they continue the same route intent; a section must not present multiple buttons that perform the same role decision with different promises. All signup CTAs route through `/get-started` with an explicit role context rather than silently choosing a role.

## CTA map

| Audience / intent | Canonical label | Destination | What the visitor should understand before clicking |
|---|---|---|---|
| Talent begins the proof path | `Build your proof` | `/get-started?role=talent` | Real work can become reviewable evidence; review is human-accountable; opportunity is not guaranteed. |
| Company begins evidence-led discovery | `Hire from evidence` | `/get-started?role=company` | The company will inspect relevant evidence before making its own hiring decision; a paid trial is bounded and compensated where supported. |
| Reviewer explores participation | `Become a reviewer` | `/get-started?role=reviewer` | Review means qualified human evaluation against a transparent rubric with conflicts, accountability, and policy requirements. |
| Visitor needs the mechanism | `See how it works` | `/how-it-works` | The proof-to-opportunity loop is understandable without product access. |
| Visitor needs trust detail | `How verification works` | `/verification` | Verification has a human review chain, sources, limits, visibility rules, and revocation. |
| Existing user returns | `Sign in` | `/sign-in` | Sign-in is an account action, not a marketing signup or role decision. |
| Visitor chooses a role | `Get started` | `/get-started` | The next step will ask for a role and set expectations before account creation. |

CTA copy must remain concrete, role-specific, and honest. Do not use `Unlock your potential`, `Get hired instantly`, `Join the revolution`, `See your score`, `Start free today`, or urgency language that is not supported by a real deadline or policy. Do not put a job guarantee, universal score, AI promise, customer count, or invented outcome inside a CTA.

## Home page

The home page is a conversion-oriented explanation, not a generic AI landing page. Its value proposition and role paths must be understandable without scrolling, while the full evidence and trust explanation continues below.

### Required section order

1. **Asymmetric hero.** Use a direct headline about real work and trusted opportunity, a short supporting explanation, `Build your proof`, and `Hire from evidence`. The hero's right side shows a real product preview or approved design artifact of evidence, review, and proof progression. It must not be a decorative dashboard made from rectangles or fabricated data.
2. **Problem section.** Explain the gap between self-reported claims and work that can be inspected with context. Use concrete language; do not attack resumes, competitors, or existing tools with unsupported weakness claims.
3. **Proof loop.** Show `choose relevant work → submit real work → qualified human review → explainable proof → evidence-led discovery → bounded paid trial → auditable outcome` as an accessible visual timeline or one purposeful sticky story. Each step has a short explanation and a static fallback.
4. **Talent section.** Explain how talent builds evidence, receives actionable feedback, controls what becomes public, and becomes discoverable through relevant proof.
5. **Company section.** Explain how a company defines a realistic project, evaluates evidence, and can start a fair paid trial with explicit scope and compensation where the approved market supports it.
6. **Verification section.** Explain reviewer accountability, transparent rubrics, conflict-of-interest checks, revision requests, and revocation. Link to `/verification`.
7. **Trust and privacy section.** Explain public versus private evidence, user-controlled visibility, human accountability, transparent recommendations, and the limits of proof before asking visitors to sign up.
8. **Reviewer path.** Explain why experienced practitioners matter and what accountable review involves. Use `Become a reviewer` only after the role and responsibility are clear.
9. **Final CTA.** Use one clear context-appropriate next action. The home page may provide the two role choices in the hero, but the final section must prioritize the visitor's next decision instead of repeating a wall of buttons.

### Home page content constraints

The home page must explain proof-of-work without requiring terms such as `taxonomy`, `RLS`, `outbox`, or `reputation event`. If a technical concept matters, translate it into plain language and provide a concise explanation. The product can name `Proof Graph` only with an explanation that it is a connected record of skills, work, reviews, and outcomes; it is not an opaque score or universal score.

The product preview must use a real component or approved design asset once available: for example, an evidence timeline with a submission version, review context, status, visibility, and next action. Before such an asset exists, use a clearly labeled preview plan rather than invented UI, fake metrics, or simulated customer activity.

## Role page UX

### `/for-talent`

**Goal:** Help talent understand the fair proof path and choose `Build your proof`.

**Section order:** role-specific hero; why real work needs context; choose a bounded project; submit work and explanation; receive qualified human review and feedback; control public proof and privacy; discover a relevant paid opportunity; clear limits and no guarantee; final `Build your proof` CTA.

The first screen must say what talent can do next and must not imply that a profile, badge, score, or AI output decides their future. The page should show the evidence order—work, provenance, review, limits, next action—using the Phase 07 design-system patterns. Mention revision and resubmission as a normal path, not as a failure identity.

### `/for-companies`

**Goal:** Help a startup founder or engineering lead understand how evidence reduces early hiring uncertainty and choose `Hire from evidence`.

**Section order:** company hero; why self-reported signals are uneven without attacking them; define a realistic project and evaluation rubric; inspect relevant reviewed evidence; compare with context and uncertainty; invite a bounded, compensated paid trial where approved; human hiring accountability; privacy and access boundaries; final `Hire from evidence` CTA.

The page must make the company value clear in one glance: inspect relevant work, understand the signal, then decide with human judgment. It must not promise a perfect hire, automate selection, suggest that a single score settles suitability, or present a paid trial as unpaid production work.

### `/how-it-works`

**Goal:** Make the complete loop understandable to all roles before signup.

**Section order:** concise loop overview; bounded work and submission; qualified human review; explainable proof and visibility; evidence-led discovery; fair paid trial; auditable outcome; role-specific next actions.

The visual treatment should use a timeline or relationship-based story with all steps available in the static reading order. The start is a relevant bounded real-world challenge; the end is an evidence-supported paid opportunity that may create an auditable outcome. The page must state that the loop is a product direction and research hypothesis, not a guarantee of a hiring outcome.

### `/verification`

**Goal:** Explain how Proofly earns trust before requesting a signup or public proof decision.

**Section order:** what `verified` means and does not mean; exact submission/version and source context; qualified human reviewer and rubric; conflicts of interest; feedback, changes requested, and resubmission; public/private/restricted visibility; revocation and correction; AI assistance boundaries; final role-appropriate CTA.

Use plain-language status labels and show the human accountability chain. `Verified` must never mean guaranteed ability, identity assurance, employment, or future performance. Proof is not public by default; private source files are not exposed by a public link. AI may assist with approved summaries, tags, matching suggestions, or safety signals, but it does not independently verify proof or decide hiring, rejection, reviewer approval, payment, enforcement, disputes, or account actions.

### `/get-started`

**Goal:** Convert understanding into the correct signup path without a sales call or demo.

**Section order:** brief expectation-setting header; three distinct role choices; role-specific explanation and CTA; privacy and account-control note; `Sign in` path for existing users.

The role choices are `Build your proof`, `Hire from evidence`, and `Become a reviewer`. A visitor should understand the relevant responsibility before proceeding. The route must not create a marketplace listing, project, application, reviewer decision, contract, or payment as part of public UX documentation.

### `/sign-in`

**Goal:** Provide a direct, accessible entry for an existing user.

The page contains the sign-in action, account recovery path, safe error states, and a restrained link to `/get-started`. It should not repeat the entire marketing funnel or expose authenticated navigation before session authorization.

### `/pricing` conditional page

If and only if pricing, reviewer economics, market, tax, payment, and policy readiness are approved, the page may explain validated plans or fees with market and currency context. Every amount must be sourced from an approved decision and labeled with applicable conditions. Until then, the route is omitted from the public sitemap and navigation or redirects to a truthful explanation that pricing is not yet published; it must never contain placeholder numbers.

## Trust and proof messaging rules

Trust content appears before a signup ask. Public pages must explain not only what Proofly helps with but also what the product does not establish.

| Rule | Public UX requirement |
|---|---|
| Evidence before claim | Lead with real work, its context, provenance, review, and limits rather than profile polish, activity counts, or popularity. |
| Verification specificity | Say what was reviewed, by whom, against which rubric, and what status means. Never use `verified` as decorative copy. |
| Human accountability | Explain that reviewers own review decisions and companies own hiring decisions. AI assistance is advisory and labeled. |
| Privacy and visibility | Explain public, private, and restricted evidence before asking a person to submit or publish. Never imply that private source files are public. |
| Uncertainty | Use precise `pending`, `under review`, `changes requested`, `not yet reviewed`, `restricted`, `revoked`, or `source unavailable` language where applicable. |
| Fair paid work | Describe paid trials as bounded, compensated work with scope and acceptance criteria. Never market unpaid production work or pay-to-apply mechanics. |
| Separate signals | Keep identity assurance, organization confirmation, reviewer approval, work verification, payout eligibility, outcomes, and risk signals distinct. Do not collapse them into a universal score. |
| Honest opportunity | Say `may lead to`, `can support`, or `where appropriate`; never say proof guarantees employment, acceptance, income, or a successful contract. |
| Transparent recommendations | If recommendations are mentioned, name the visible evidence and limits. Do not claim an opaque algorithm understands talent. |
| No invented social proof | Do not add logos, testimonials, named customers, usage counts, conversion rates, earnings, success stories, countdowns, or urgency without approved source evidence. |

Competitor references should explain Proofly's evidence-centered position without claiming that another product is weak or that Proofly is uniquely impossible to copy. The public site must not turn adjacent tools, activity, ratings, or screening into automatic proof.

## Responsive behavior

Responsive behavior follows the Phase 07 visual system and keeps the primary action and evidence order intact.

| Viewport | Required behavior |
|---|---|
| Wide desktop | Keep navigation on one line, use the asymmetric hero, retain a clear two-column preview, and keep the hero headline usually within two lines. |
| Standard desktop | Preserve section hierarchy and readable measure; reduce decorative variance before reducing evidence context or CTA clarity. |
| Tablet | Rebalance asymmetric columns without creating a cramped dashboard; keep the primary CTA visible and move supporting preview below when necessary. |
| Below `768px` | Use a single-column collapse below `768px` for asymmetric marketing layouts, in reading order: headline, explanation, primary role action, secondary role action, then preview. Use `min-h-[100dvh]`, never `h-screen`, and maintain no horizontal overflow. |
| Small mobile | Stack CTAs with distinct labels, let long copy wrap safely, convert timelines to vertical steps, and replace wide comparisons with labelled rows or focused flows. Never force horizontal overflow for proof context. |
| All sizes | Preserve work → provenance → review → status/limits → next action. Maintain visible focus, touch-safe targets, semantic headings, readable contrast, and accessible status text. |

Interactive previews, timelines, accordions, and navigation must define loading, error, empty, mobile, and reduced-motion states. The static reading order must retain the full explanation when motion, JavaScript, or a narrow viewport is unavailable. Marketing motion uses restrained transform/opacity; it must not create false urgency.

## SEO and sharing requirements

SEO must describe the actual approved product direction, not fabricate traction, market leadership, customer outcomes, or feature availability. Every public route has unique metadata and a canonical URL.

| Route | Title direction | Description direction | Search/share requirements |
|---|---|---|---|
| `/` | `Proofly — Trusted opportunities through real work` | Explain the global proof-of-work network for early-career software talent and startups, with independently reviewed work and human hiring judgment. | Canonical home URL; truthful default Open Graph image using approved brand/design asset; `WebSite`/`Organization` structured data only for facts actually approved. |
| `/for-talent` | `For talent — Build your proof with Proofly` | Explain how real software work becomes reviewable, understandable evidence with feedback and user-controlled visibility. | Role-specific canonical and share image; no guaranteed job or earnings language. |
| `/for-companies` | `For companies — Hire from evidence with Proofly` | Explain evidence-led discovery before human hiring judgment and the bounded paid-trial path where supported. | Role-specific canonical and share image; no perfect-hire or conversion claims. |
| `/how-it-works` | `How Proofly works — From real work to trusted opportunity` | Summarize the proof-to-opportunity loop from bounded work through human review, proof, and a possible paid opportunity. | `HowTo` structured data only if the final content is a truthful step sequence and implementation supports it; no fabricated results. |
| `/verification` | `How verification works — Proofly` | Explain review rubrics, reviewer accountability, privacy, revisions, visibility, revocation, and the limits of proof. | Truthful canonical/share metadata; do not use `Review` aggregate schema to imply customer ratings. |
| `/pricing` | `Pricing — Proofly` only after approval | State approved pricing with market, currency, conditions, and effective date; before approval, do not publish pricing metadata. | Include price structured data only for approved, current, public offers with truthful terms. |
| `/sign-in` | `Sign in — Proofly` | Concise account-entry description; avoid indexing private/authenticated surfaces. | `noindex, nofollow`; canonical may be omitted or self-referential according to implementation policy. |
| `/get-started` | `Get started with Proofly` | Explain role selection and the first signup expectation without promising outcomes. | Truthful canonical/share metadata; no `JobPosting`, `Product`, or review claims. |

### Technical SEO rules

- Every public route has a **unique title and description**, plus a single canonical URL policy with normalized origin, trailing-slash behavior, locale handling, and query-parameter exclusion documented before development.
- Generate `sitemap.xml` only for public, indexable routes that are approved and available. Exclude `/sign-in`, private routes, conditional `/pricing`, query variants, and any route not ready for public use.
- Generate `robots.txt` to keep authenticated, preview, admin, and internal paths out of indexing. Do not use robots rules as a privacy boundary for private data.
- Define one Open Graph/Twitter-compatible image system using the Phase 07 palette, typography, and evidence-first composition. Do not create decorative metric walls or fake product screenshots.
- Use structured data only where the page content supports it: `Organization`, `WebSite`, `WebPage`, and potentially truthful `HowTo` or approved offer data. Never fabricate `Review`, `AggregateRating`, `JobPosting`, `Product`, `Person`, customer, or outcome data.
- Use unique, concise headings and descriptions with canonical product vocabulary. Do not keyword-stuff or make unsupported comparisons.
- Validate title length, description clarity, canonical output, Open Graph dimensions/alt behavior, structured-data validity, sitemap membership, robots exclusions, and noindex behavior in later implementation QA.

## Product-preview and asset rules

A marketing preview may use only a real component, a Phase 07-approved design artifact, or a clearly labeled conceptual placeholder approved for this purpose. It may show evidence timeline structure, submission context, review rubric context, status, visibility, or next action using synthetic content only when the preview is clearly marked as illustrative and does not present a fabricated customer, metric, review result, or user outcome.

Do not build an authenticated dashboard inside the marketing site. Do not simulate marketplace liquidity, application volume, reviewer earnings, payment success, or talent outcomes. Do not use fake dashboard rectangles as a substitute for product clarity. Final visual assets and implemented components are later-phase work.

## Implementation handoff and completion gate

Before public marketing implementation begins, the product, design, accessibility, research, security, SEO, and policy owners must approve the public route list, each page goal, section order, CTA destination, trust copy, responsive states, preview asset provenance, pricing gate, canonical rules, sitemap/robots policy, and structured-data policy.

Phase 08 is complete when a visitor can understand Proofly, select talent/company/reviewer intent, understand how real work becomes reviewable proof, understand privacy and human accountability, and reach the correct signup action without requiring a sales call or product demo. This document defines the UX contract; it does not claim that the public site has been built or that product behavior is implemented.

## Phase 10 public foundation reconciliation

The implemented public scope is currently the homepage `/`. Its required metadata is owned by `app/layout.tsx`; its title and description must remain unique, factual, and aligned to the approved homepage message. It renders an intentional canonical policy, Open Graph/Twitter image route, `robots.txt`, and sitemap. The sitemap includes `/` only when a valid `NEXT_PUBLIC_APP_URL` is configured; it must not advertise unimplemented, conditional, authenticated, preview, or internal routes.

The homepage begins with a visible-on-focus skip link and follows `header → named primary navigation → main → labelled sections → footer` reading order. Decorative hero art has empty alternative text; evidence, review, and privacy art carries explanatory alternative text. The mobile header uses an explicit native disclosure rather than hiding the primary navigation with no replacement. All links and controls retain accessible names, keyboard focus, and touch-safe targets; the disabled sign-in affordance explains that authentication remains out of scope.

Below `768px`, the asymmetric homepage collapses into one reading order and keeps the text and evidence preview available. The decorative hero atlas may be removed at that size, but the real preview component remains. At standard breakpoints `640px`, `768px`, `1024px`, `1280px`, and `1536px`, typography, gutters, navigation, preview, and CTA hierarchy must adapt without horizontal overflow, clipped text, or evidence hidden behind a horizontal interaction.

The public page must preserve a static complete reading order when reduced motion is requested. Where reduced transparency is available, translucent navigation and panels resolve to opaque surfaces. These preference fallbacks are product comprehension requirements, not decorative options.

## References

- [Master PRD](MASTER_PRD.md)
- [Product Vision](PRODUCT_VISION.md)
- [Research Evidence](RESEARCH_EVIDENCE.md)
- [Competitor Analysis](COMPETITOR_MATRIX.md)
- [Domain Model](DOMAIN_MODEL.md)
- [Design System](DESIGN_SYSTEM.md)
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
- [Test Plan](TEST_PLAN.md)
