# Proofly Master Product Requirements

## Product definition

**Proofly is a global proof-of-work network for junior and early-career software developers and startups: talent earns trusted opportunities through independently reviewed real work, while companies discover and hire through evidence rather than self-reported resumes alone.**

## Product purpose

Proofly improves the quality of the work signal available before a hiring decision. It gives software talent a structured way to turn real project work into reviewable, portable evidence, and gives startups a clearer path from relevant evidence to a bounded paid opportunity. Proofly supports human judgment; it does not replace it.

The product vision is global, but the initial production launch is limited to an explicit approved market register. Country, currency, tax, worker-classification, payment, privacy, support, and moderation readiness must be proven before each market is enabled. “Global” describes the intended network direction, not an assertion that every market is launched or supported.

## First product wedge

The first wedge is deliberately narrow:

| Dimension | Initial scope |
|---|---|
| Talent | Junior and early-career software developers |
| Companies | Startups and small product teams |
| Work | Frontend, full-stack, backend, and product engineering projects |
| Language | English first |
| Currency | USD first, with internationalization designed into the model |
| Opportunity path | Independently reviewed real work leading to a relevant paid trial and, where appropriate, a contract |

The wedge does not expand to every profession or every employer type until Proofly has a credible evidence model and qualified reviewers for the additional category.

## Target audiences and roles

Proofly has three explicit roles. One authenticated person may act as talent or reviewer, and may participate as a company member; an organization represents a company or team.

| Audience | Role in Proofly | Primary outcome |
|---|---|---|
| Talent | A junior or early-career software developer who submits real work and controls what verified proof becomes public | Understand what to build next, prove specific skills with credible evidence, receive useful feedback, and reach paid opportunities without relying only on pedigree |
| Company | A startup or small product team that defines realistic work, evaluates evidence, and creates bounded paid opportunities | Define a meaningful work signal, find relevant verified talent, compare evidence fairly, and reduce hiring uncertainty through a paid trial |
| Reviewer | A qualified human who evaluates submissions against a transparent rubric and explains the decision | Apply relevant expertise, provide high-quality feedback, build a trusted reviewer reputation, and be accountable for the quality of review |

Identity assurance, organization confirmation, reviewer approval, payout eligibility, and work verification remain separate signals. None is presented as a hidden or universal measure of a person's ability.

## Core problem

Early-career software talent often has ability that is difficult to communicate through self-reported resumes, inconsistent portfolios, certificates without work context, or activity signals that do not establish delivery quality. Companies and startup teams consequently have limited, uneven evidence when evaluating people who have not yet accumulated strong pedigree or conventional experience. Reviewers need a structured way to make their expertise useful and accountable without becoming an opaque gatekeeper.

Existing signals are insufficient because they can show claims, presentation, completion, or activity without consistently connecting a specific piece of real work to its provenance, a transparent evaluation, and a meaningful work outcome. Proofly is designed to strengthen that chain. These are product hypotheses to validate through research, not claims that the workflow is already proven.

## Product promise

> **Build a trusted work identity from real projects, and move from independently reviewed evidence to a relevant paid opportunity.**

For talent, Proofly makes specific skills legible through evidence and useful review. For companies, it makes relevant work easier to inspect and compare before a hiring decision. For reviewers, it makes high-quality human judgment visible, structured, and accountable.

## Differentiation

> **Proofly is the evidence-centered bridge between real software work and a trusted hiring decision: it connects a versioned submission to qualified human review, explainable public proof, and a bounded paid trial—without becoming another resume profile, job board, open proposal marketplace, or opaque talent score.**

Proofly is not a resume site, a generic job board, or a generic freelance marketplace. Its differentiation is the transparent, accountable chain from real work to qualified human review to explainable proof to bounded paid opportunity. LinkedIn, GitHub, Upwork, and curated networks each solve important parts of identity, technical context, project execution, payment, or screening; Proofly is designed to connect those parts for the narrow software-talent/startup wedge without treating any adjacent product's activity, ratings, or screening as automatic proof.

This position is a product decision and validation hypothesis, not a claim that competitors cannot add similar capabilities. The dated evidence, parity map, white-space opportunities, copying risks, moat hypotheses, integration boundaries, and open validation needs are maintained in the [Competitor Analysis](COMPETITOR_MATRIX.md).

## Proof-to-opportunity loop

The loop starts when a talent participant chooses a relevant real-world challenge or project and ends when the resulting evidence supports a paid opportunity and creates a new, auditable outcome.

1. **Choose a relevant challenge.** Talent discovers a bounded software project aligned with a skill they want to demonstrate.
2. **Submit real work.** Talent submits a working solution with supporting evidence and an explanation of the work.
3. **Receive qualified human review.** An approved reviewer evaluates the submission against a transparent rubric, declares conflicts, and gives actionable feedback.
4. **Record verified proof.** Proofly links the exact submission, review decision, reviewer, skill, and outcome into the talent's Proof Graph. Public proof requires a valid review chain and the appropriate user-controlled visibility decision.
5. **Discover through evidence.** A startup or small product team finds relevant talent through visible, explainable evidence rather than claims alone.
6. **Start a bounded paid trial.** The company and talent can use a scoped, compensated trial to evaluate collaboration without unpaid production work or pay-to-apply mechanics.
7. **Create an outcome and strengthen the record.** A completed paid trial may progress to a contract. The resulting outcome becomes an auditable reputation event, and the loop can begin again with stronger context.

Human reviewers remain accountable for verification, and companies remain accountable for hiring. AI may support summarization, tagging, matching suggestions, or safety detection only when the use is approved, transparent, source-linked, and correctable; it cannot independently verify proof or decide hiring, rejection, payment, enforcement, disputes, or account actions.

## Governed software skill language

Proofly uses a governed, versioned skill taxonomy for the initial software-developer wedge. It gives talent, companies, reviewers, challenges, review rubrics, search, and future explainable matching one understandable capability vocabulary without turning taxonomy data into a full profile, automatic extraction system, or opaque ranking model. The initial release is **taxonomy version `1.0.0`** and is limited to five software families:

| Family | Initial skill scope |
|---|---|
| Foundations | JavaScript, TypeScript, HTML, CSS, Web accessibility, HTTP and web fundamentals, and Git |
| Frontend | React, Next.js, State management, Component design, Responsive layout, Performance optimization, and Testing |
| Backend | Node.js, API design, Authentication, Authorization, Data validation, Background jobs, and Observability |
| Data and infrastructure | PostgreSQL, Data modeling, SQL, Cloud deployment, CI/CD, Caching, and Security fundamentals |
| Product engineering | Requirements interpretation, Debugging, Technical communication, Code review, Documentation, and Collaboration |

The language uses the descriptive levels **Familiar**, **Working**, **Independent**, **Advanced**, and **Reviewer**. A level always states its evidence context and difficulty; it is not a numeric score or whole-person conclusion. “Reviewer” describes the ability to evaluate a skill against a defined rubric, not reviewer approval, elevated access, or an automated authority to verify proof. A person can hold different evidence-backed levels across related skills.

Skill evidence is deliberately separate from verified proof. The permitted evidence types are self-claim, imported work, open-source activity, practice challenge, company challenge, reviewer assessment, paid project outcome, and endorsement with context. Each records the source, context, difficulty rationale or rubric/challenge reference, visibility, and taxonomy version. Only a valid human-reviewed proof chain can create verified proof; self-reported or imported evidence remains visibly unverified until it meets the applicable review rules.

Skills may have explicit parent/child, related, prerequisite, and common-project-context relationships. A challenge or rubric may require several exact skills and transparent, purpose-bound weights. Those weights explain the work requirement; they never calculate a universal talent score or independently decide discovery, verification, hiring, or payment. A company search must preserve the difference between a contextual claim and verified proof and show the evidence source and taxonomy version behind any visible result.

Taxonomy is governed data. A person can suggest a missing skill or clarification, but cannot directly change canonical skill records, challenge requirements, rubrics, proofs, search results, or future matching inputs. Governed review publishes a new version with the proposer, owner, qualified domain review, reason, and compatibility impact recorded. Definitions are revised rather than silently overwritten. Deprecated skills remain readable in historical proof with their original key, label, definition revision, taxonomy version, and any documented successor mapping. This taxonomy discipline supports evidence quality; it does not claim that the taxonomy or level model has been validated by research.

## Non-goals for the first release

The first release is not:

- A general-purpose social network or popularity-driven professional feed.
- A generic job board built around unverified listings and applications.
- A generic freelance marketplace with proposal volume, race-to-the-bottom dynamics, or open-ended unpaid work.
- A course library or certificate platform competing on completion alone.
- A universal or opaque talent score that collapses evidence, identity, risk, or reputation into one ranking.
- A full talent profile, automatic skill extraction, or unreviewed taxonomy editing feature introduced merely because the governed skill language exists.
- A system that fully automates proof verification, hiring, rejection, reviewer approval, payments, enforcement, disputes, or account decisions.
- A platform for every profession before each category has a credible evidence model and qualified reviewers.
- A claim that every country, language, payment route, or legal workflow is supported at launch.

## Product principles

| Principle | Product implication |
|---|---|
| Evidence before claims | Put provenance, work context, and review evidence ahead of self-description or activity counts. |
| Human accountability | Keep verification, hiring, and consequential decisions with authorized people and auditable processes. |
| Explain important signals | Show the evidence, rubric context, source references, uncertainty, and limits behind recommendations or reputation signals. |
| No hidden universal score | Keep identity assurance, work verification, reviewer quality, outcomes, and risk signals distinct and purpose-bound. |
| Make the next action obvious | Every journey should help talent, companies, and reviewers understand what to do next without hiding critical requirements. |
| Respect control and privacy | Let people preview public proof, keep private evidence restricted, and collect only what supports the current outcome. |
| Fair paid work | Keep paid trials bounded and compensated; never require unpaid production work or payment to apply. |
| Trust through consistent detail | Use transparent rubrics, conflict controls, review provenance, auditable corrections, and clear status language. |
| Accessible and global by design | Support keyboard use, mobile reading and review, assistive technology, localization, and market-specific readiness without inferring identity or eligibility from device signals. |

## Success direction

Phase 01 defines a measurable direction, not validated results. The first release should be judged by whether the core proof-to-opportunity loop produces credible, safe progress for each role.

| Success signal | Directional measure |
|---|---|
| Talent reaches first proof | Share of eligible first-time talent participants who submit a bounded proof project and receive a completed qualified review. |
| Review creates useful evidence | Share of reviewed submissions with a complete rubric-based decision, actionable feedback, conflict checks, and a valid proof record when eligible. |
| Company reaches relevant evidence | Share of active target companies that reach at least one relevant verified candidate through evidence-led discovery. |
| Evidence supports paid work | Count and rate of bounded paid trials that begin after relevant proof is discovered, with scope and compensation recorded. |
| The loop repeats | Share of talent receiving a repeat opportunity and share of companies returning to a relevant evidence-led workflow. |
| Trust remains intact | Dispute, fraud, fake-review, privacy, unpaid-work, and payment-integrity signals remain within approved risk thresholds, with human review and auditable resolution. |

Exact thresholds, cohort definitions, market scope, owners, and evidence artifacts must be approved before launch and recorded in the research, economics, compliance, and release-gate documents. No success signal is a claim of current validation.

## Product boundaries

The product boundary is defined by the evidence chain and by accountable human decisions.

**In scope for the first release:** bounded software work, structured submissions, independently reviewed proof, explainable evidence-led discovery, applications, paid trials, and the auditable transition to contract where the approved market and payment model support it.

**Outside the first-release boundary:** unsupported markets, unapproved payment or payout flows, regulated identity decisions recreated inside Proofly, public exposure of private evidence, automatic inference of ability or trustworthiness, and any client-side or AI-generated claim treated as verification truth.

The Phase 16 skill taxonomy is product infrastructure for contextual evidence and future explainable consumers. It does not authorize a profile surface, user-controlled canonical vocabulary, automatic AI skill extraction, opaque candidate scoring, a matching decision, or any new implementation feature.

Public proof can exist only after a valid submission and completed human review, with the appropriate consent and visibility decision. Private submission materials remain restricted to authorized participants. Payment truth comes from verified provider state, not client claims. Reputation changes reference auditable events. Corrections create new records or versions rather than rewriting history.

## Research status

The product direction and workflow are hypotheses until real participants validate them. Phase 01 intentionally does not add market claims, fabricated research, implementation behavior, or launch approval. The next phase must test whether junior developers can complete bounded proof work, companies trust reviewed evidence more than a portfolio alone, reviewers find the incentive acceptable, paid trials reduce uncertainty without creating unpaid labor, and users understand why evidence is credible.
