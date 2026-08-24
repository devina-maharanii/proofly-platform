# Test Plan

## Purpose and evidence rule

This plan defines verification layers for Proofly. A completed check requires a timestamped artifact, an environment, an accountable owner, and an observed result. A route, file, or checklist entry alone is not evidence that behavior works.

## Baseline quality layers

| Layer | Purpose | Required scope |
|---|---|---|
| Unit | Prove deterministic rules and component contracts | Domain invariants, validation, calculation, state, permissions, and public metadata helpers. |
| Integration | Prove protected boundaries work together | RLS, server actions, provider adapters, storage, webhooks, and events when implemented. |
| End-to-end | Prove a person can complete a critical journey | Talent, company, reviewer, administrator, recovery, deletion, paid-work, and dispute journeys when the related product scope is enabled. |
| Public-page foundation | Prove public pages are understandable, indexable, keyboard usable, responsive, and performant | SEO, accessibility, responsive behavior, browser console/network review, and performance evidence. |

## Phase 10 public release gate

The current implementation scope is the indexable homepage `/` and its generated public assets. `/for-talent`, `/for-companies`, `/how-it-works`, `/verification`, `/get-started`, `/sign-in`, and conditional `/pricing` remain documented future routes; they must not be added to the sitemap, navigation, or release evidence until separately implemented and approved.

| Gate | Required evidence | Owner | Current implementation rule |
|---|---|---|---|
| Public route metadata | Unique title, description, canonical policy, Open Graph/Twitter image, and truthful metadata test | Engineering with Product/Marketing copy approval | `/` owns its approved metadata through `app/layout.tsx`; future routes own their own metadata when implemented. |
| Crawl controls | Valid `robots.txt`, XML sitemap membership, no accidental indexing of private/authenticated paths | Engineering | Sitemap returns only the configured public homepage. Robots excludes `/api/`, `/admin/`, `/sign-in`, and `/get-started`; robots is never a privacy control. |
| Semantic accessibility | One page heading, header/navigation/main/footer landmarks, descriptive links, meaningful image alt behavior, no fabricated structured data | Engineering with Design review | The homepage uses a skip link, named navigation, `main#main-content`, labelled sections, and empty alt only for decorative hero art. |
| Keyboard and focus | Keyboard walkthrough, visible focus, logical focus order, named icon control, no trap | Engineering with QA | Tab reaches skip navigation first, then public controls in reading order. The theme control has an accessible name; disabled sign-in communicates its Phase 10 boundary. |
| Contrast and status | WCAG AA scan plus manual light/dark review; no color-only state | Design with Engineering | Cobalt, graphite, fog, and semantic state pairs use text/icon/structure as well as color; dark primary actions use readable ink. |
| Motion and transparency | `prefers-reduced-motion` and reduced-transparency browser check | Design with Engineering | Non-essential animation becomes effectively instant; static reading order and state text remain complete; translucent surfaces become opaque where the preference is available. |
| Responsive behavior | Narrow phone, large phone, tablet, laptop, wide desktop, and text-zoom matrix | Engineering with QA | Below `768px`, asymmetric content collapses into reading order, product preview stays visible without decorative hero media, navigation exposes a native disclosure, and no horizontal overflow is permitted. |
| Performance | Lighthouse JSON artifact, production build output, layout-shift inspection, and public bundle review | Engineering | Use `next/font`, dimensioned `next/image`, a prioritized hero media item only when it is meaningful content, lazy non-essential and below-fold media, static public reading order, no third-party marketing script, and optional no-op-until-configured Web Vitals reporting. |

## Public performance budget

The following values are **release decisions**, not claims about a particular user’s device or network. They are evaluated from a documented production-like run before a public release.

| Metric or condition | Public release target | Verification |
|---|---|---|
| Largest Contentful Paint | Under 2.5 seconds | Recorded Lighthouse field/lab evidence and production monitoring where configured. |
| Interaction to Next Paint | Under 200 milliseconds for primary public controls | Browser interaction check and Web Vitals monitoring when `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` is configured. |
| Cumulative Layout Shift | Under 0.1 | Lighthouse plus viewport visual review; font and image dimensions must reserve space. |
| Lighthouse categories | Accessibility, best practices, SEO, and performance results recorded for `/` | `pnpm lighthouse:home` JSON artifact, with material regressions reviewed before release. |
| JavaScript and media | No avoidable third-party script, unbounded client payload, or non-lazy below-fold media | Build review, source review, and network log. |

## Responsive test matrix

| Viewport or condition | Expected result |
|---|---|
| 320px narrow phone | No horizontal scroll; skip link, menu, CTAs, and product preview remain reachable. |
| 375px standard phone | Single-column reading order; 44px controls; stacked CTAs; product preview retains evidence/status/next-action context. |
| 412px large phone | Long labels wrap rather than clip; disclosure navigation remains usable. |
| 768px tablet | Evidence hierarchy remains visible; navigation changes intentionally rather than disappearing. |
| 1024px laptop/tablet landscape | No cramped two-column content; ledger rows and preview remain legible. |
| 1280px desktop | Editorial hierarchy, persistent navigation, and readable line length remain intact. |
| 1536px wide desktop | Maximum width and gutters preserve comfortable measure rather than stretching content. |
| 200% text zoom and reduced motion | No overlap, clipping, lost focus, hidden state, or motion-dependent information. |

## Phase 10 validation record

| Check | Artifact | Owner | Status at completion |
|---|---|---|---|
| Formatting, lint, strict type check, unit tests, and production build | Package scripts and CI logs | Engineering | Required before commit. |
| Keyboard, metadata, landmark, axe, mobile-menu, no-overflow, and reduced-motion checks | Playwright public-foundation suite | Engineering/QA | Required before commit. |
| Lighthouse | `.reports/lighthouse-home.json` from a local production server | Engineering | Required before commit; recorded result is reviewed against the budget. |
| Browser console and network | Public-route log review plus manual desktop/mobile screenshots | Engineering/QA | Required before commit. |
| Complete diff and scope | Git diff review | Engineering/Product | Required before commit; no dashboards, authentication, marketplace behavior, payments, database mutation, or AI feature work. |

## Cross-cutting release conditions

Public release remains blocked by a high-severity security, privacy, payment, trust, or accessibility issue; a broken primary journey; unverified production configuration; inactive error monitoring; an undocumented rollback path; or missing evidence for a required gate. Later feature phases add RLS, provider, domain lifecycle, event, AI, internationalization, payment, and trust tests without weakening these public-page checks.
