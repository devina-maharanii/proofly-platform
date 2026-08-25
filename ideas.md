# Proofly Homepage Design Direction

## Three possible approaches

| Theme Name                    | Very Brief Intro                                                                                                                                                                                | Probability |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------: |
| **Evidence Ledger Editorial** | A precision-editorial developer-tool language where proof is treated as a readable chain of work, review, and opportunity. The feeling is composed, rigorous, and human rather than decorative. |        0.07 |
| **Field Notes Workshop**      | A warm, utilitarian workbench direction with annotation, material texture, and notebook-like sequence. It would emphasize practice and iteration over career theatre.                           |        0.04 |
| **Signal Atlas**              | A spatial, index-like system that maps skills, reviews, and context as connected signals. It would feel exploratory and calm, with a stronger diagrammatic voice.                               |        0.09 |

## Chosen approach: Evidence Ledger Editorial

### Design Movement

**Swiss editorial systems reframed for a serious developer tool.** The landing page uses asymmetric composition, strong typographic hierarchy, technical metadata, quiet dividers, and relationship diagrams rather than rounded-card marketing tropes.

### Core Principles

1. **Evidence leads.** Work context, review state, provenance, and next action carry more visual weight than decorative badges or implied scores.
2. **Trust is legible.** Every strong claim is accompanied by an explanation, status, boundary, or human-accountability cue.
3. **Precision stays human.** Dense technical information is structured with warmth, breathing room, and accessible plain language.
4. **Contrast creates hierarchy.** Editorial scale shifts, linework, and cobalt action states organize the page rather than gradients, glow, or chrome.

### Color Philosophy

Cool graphite and fog establish composure and reading comfort. A single electric cobalt is reserved for action, selected evidence, and the product’s recognizable signal. Semantic green, amber, and red communicate actual status only; they never become brand decoration.

### Layout Paradigm

The page is a **left-aligned editorial ledger**. The hero uses an asymmetric split between a written argument and an inspectable proof preview. Subsequent sections shift between a numbered rail, a timeline, a two-part comparison, and a dense trust index so the page has structural variety without turning into a grid of identical cards.

### Signature Elements

1. **Proof rail:** a vertical rule with step numbers and compact state labels that carries the proof-to-opportunity narrative.
2. **Evidence stamps:** compact mono labels for status, source, and human review context.
3. **Cobalt signal line:** a narrow, intentional cobalt rule used for active proof and primary actions only.

### Interaction Philosophy

Interaction must clarify scope, source, status, or next action. Buttons acknowledge press without theatrical motion. Hover is supplemental; focus and visible state are the accessible source of truth. The page never asks a visitor to trust an animation, a score, or an unexplained badge.

### Animation

Use one isolated client-side motion boundary only for optional entry treatment. At normal motion preference, hero labels and proof steps may fade/translate into place with restrained transform/opacity transitions. The proof rail may reveal sequentially because sequence conveys meaning. Under `prefers-reduced-motion`, all content is immediately visible and no hierarchy is lost. No scroll listeners, parallax, perpetual effects, or pointer-driven motion are permitted.

### Typography System

**Geist Sans** is used for direct editorial headlines and accessible interface copy. **Geist Mono** is used sparingly for status, source, IDs, technical metadata, and proof-context labels. Headlines are compact, left-aligned, and normally constrained to two desktop lines; body copy is short, specific, and readable.

### Brand Essence

**Proofly is the evidence-centered bridge from real software work to trusted opportunity for early-career talent, startups, and accountable reviewers.**

Personality: **precise, humane, accountable**.

### Brand Voice

Headlines state what work becomes visible and why that matters. CTAs name the role-specific next action. Microcopy names a state, source, limit, or recovery path without pressure.

> “Build work people can trust.”

> “Review the work. Understand the signal.”

Generic filler such as “Welcome to our website” and “Get started today” is prohibited.

### Wordmark & Logo

Use a bold **proof marker**: a cobalt vertical rule interrupted by a small graphite node, representing a checked link in an evidence chain. The mark is graphic-only, has no text, and appears beside the custom Proofly wordmark rather than replacing it.

### Signature Brand Color

**Proof Cobalt — `#285DDE` in light mode and `#86A8FF` in dark mode.**

## Style Decisions

- The hero is asymmetrically split, never centered over a mesh or gradient.
- The product preview is a real reusable interface component, not a screenshot or fake metrics panel.
- Cobalt appears only on primary action, active evidence, and intentional signal line elements.
- The page uses at least four layout families: asymmetric hero, problem editorial block, proof rail, role comparison, and trust index.
- Copy presents human review, privacy, and limits before asking visitors to act.
- The proof marker pairs a cobalt line-and-node glyph with an editorial `/ evidence` wordmark rather than default brand text.
- Primary navigation and final actions name a role or evidence decision; generic `Get started` language is excluded from prominent surfaces.
- Every major visual panel carries an inspectable proof concept such as a source, state, review, privacy boundary, provenance cue, or next action.
- Authentication surfaces use the same proof rail, compact mono evidence stamps, and intentional cobalt signal line as the public evidence ledger.
- The auth wordmark always pairs the cobalt vertical marker and graphite node with the custom Proofly `/ evidence` treatment; a generic letter-in-a-box is prohibited.
- Account-entry actions name the specific evidence decision: building proof, inspecting evidence, or requesting reviewer context rather than generic selection language.
