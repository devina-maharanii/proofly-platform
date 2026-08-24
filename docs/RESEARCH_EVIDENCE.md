# Proofly Research Evidence Register

## Purpose and claim-label policy

This register is the single source of truth for Phase 02 research status. Every substantive statement is labeled as one of four types:

| Label | Meaning | Permitted use in this register |
|---|---|---|
| **Evidence** | A recorded observation with a source, method, participant context, consent status, and traceable record | May support a validated problem statement or product decision. |
| **Assumption** | A proposition carried forward from the product direction or a research hypothesis that has not been tested | Must remain explicitly unvalidated and have a test plan. |
| **Unknown** | A question for which the current register has no reliable answer | Must not be presented as a result, score, or market claim. |
| **Decision** | An approved product or research choice made from the locked direction, a trust requirement, or recorded evidence | Must state its basis and must not be misrepresented as user validation. |

No interviews, quotes, surveys, statistics, observed task outcomes, or user outcomes are recorded in this Phase 02 register. No claim of validation is made. The product concept remains a set of hypotheses until consented participant research is completed and linked here.

## Research status

**[Evidence]** At Phase 02 completion, the repository contains the Phase 01 product documents but no participant interview notes, observed workflow records, survey responses, research quotes, or measured user outcomes. This is a documentation audit observation, not user research evidence.

**[Decision]** Keep the Phase 01 first wedge and proof-to-opportunity direction unchanged while research is pending. Do not broaden the niche, add product scope, or rewrite the product promise from unobserved assumptions.

**[Unknown]** The current register does not establish whether the proposed problem, language, workflow, reviewer model, or paid-trial transition is important, frequent, understandable, or trusted by the target audiences.

## Research audiences

The research plan covers the three roles in the approved initial wedge. These are recruitment targets, not completed participants.

| Audience | Planned cohort | Required context | Status |
|---|---:|---|---|
| Talent | 5 junior or early-career software developers from different backgrounds | Current ways of proving ability, project experience, privacy preferences, and motivation | **[Decision] Planned; no participants recorded** |
| Company | 5 startup founders, engineering leads, or hiring managers | Current evaluation practice, evidence standards, hiring uncertainty, paid-trial practice, and adoption barriers | **[Decision] Planned; no participants recorded** |
| Reviewer | 3 experienced reviewers or mentors | Review quality, repeatability, conflicts, effort, incentives, and accountability | **[Decision] Planned; no participants recorded** |

The research remains limited to junior and early-career software talent, startups and small product teams, and experienced reviewers or mentors. Other professions, large-enterprise segments, and broad labor-market claims are out of scope for Phase 02.

## Research questions

### Talent questions

| ID | Question | Decision it informs | Status |
|---|---|---|---|
| TQ-01 | How do junior and early-career software developers currently prove ability? | Whether Proofly should support the existing proof context without treating activity or presentation as automatic proof | **[Unknown]** |
| TQ-02 | Where do resumes and portfolios fail them? | Whether the proposed evidence chain addresses a problem participants actually experience | **[Unknown]** |
| TQ-03 | What makes a project feel worth completing? | Challenge scope, motivation, effort, and completion-risk priorities | **[Unknown]** |
| TQ-04 | What kind of review would they trust? | Reviewer explanation, rubric transparency, provenance, feedback, and visibility requirements | **[Unknown]** |
| TQ-05 | What information would they never make public? | Public-proof consent, privacy controls, and restricted evidence boundaries | **[Unknown]** |

### Company questions

| ID | Question | Decision it informs | Status |
|---|---|---|---|
| CQ-01 | How are junior developers evaluated today? | Whether the first-release workflow fits a real buyer process | **[Unknown]** |
| CQ-02 | What makes a portfolio credible? | Which evidence context and provenance a company can inspect responsibly | **[Unknown]** |
| CQ-03 | Would a paid trial reduce hiring uncertainty? | Whether a bounded paid trial belongs in the first release and under what conditions | **[Unknown]** |
| CQ-04 | Which evidence would justify contacting a candidate? | Evidence-led discovery, explanation, and contact criteria | **[Unknown]** |
| CQ-05 | What would block adoption? | Security, privacy, legal, workflow, budget, fairness, and trust requirements | **[Unknown]** |

### Reviewer questions

| ID | Question | Decision it informs | Status |
|---|---|---|---|
| RQ-01 | What would make a review fair and repeatable? | Rubric design, calibration, review quality, and correction requirements | **[Unknown]** |
| RQ-02 | What conflicts of interest must be controlled? | Reviewer eligibility, conflict declaration, recusal, and audit requirements | **[Unknown]** |
| RQ-03 | What would make reviewing worth their time? | Effort, compensation, feedback, reputation, and capacity assumptions | **[Unknown]** |

## Research method and evidence quality

**[Decision]** Use semi-structured interviews plus one observed workflow task per participant. Ask about current behavior before showing the smallest relevant Proofly concept. Do not lead with the solution or ask participants to predict adoption.

**[Decision]** Store only non-identifying participant context, consent status, research method, moderator, exact observation or compliant short quote, interpretation, confidence, decision affected, and follow-up validation need. Do not store unnecessary names, contact details, identity documents, or raw recordings in the product repository.

### Source-quality levels

| Level | Source type | What it can support | Current status |
|---|---|---|---|
| S0 | Direct observation or participant statement with consent, method, date, role context, and traceable record | A specific evidence record and a carefully bounded interpretation | **[Unknown] No records available** |
| S1 | Observed workflow task result with participant context and facilitator notes | Task-completion, comprehension, and workflow-friction evidence | **[Unknown] No records available** |
| S2 | Repeated coded pattern across the planned audience cohort | A validated problem statement or segment-specific finding | **[Unknown] No records available** |
| S3 | Existing internal product, domain, security, economics, or architecture document | Product constraints, hypotheses, and decisions; not user validation | **[Evidence] Available as design baseline** |
| S4 | Unattributed claim, invented quote, unsupported statistic, or prediction of adoption | Nothing; it must not enter the register | **[Decision] Prohibited** |

The Phase 01 documents and the locked Phase 02 brief are **S3 inputs**. They define the product direction and hypotheses but do not constitute participant evidence.

## Evidence register

No observed evidence records are entered until actual research is conducted. The following table is intentionally empty of fabricated observations.

| Evidence ID | Date | Audience and context | Method | Observation or quote | Interpretation | Confidence | Decision affected | Consent/recording status | Source quality | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | **[Unknown] No observation recorded** | — | — | — | — | — | **[Unknown] Pending research** |

A future record must use an immutable `evidenceId`, a date, non-identifying participant context, method and moderator, a direct observation or compliant short quote, a separately labeled interpretation, confidence, affected decision, follow-up validation, consent status, and a source-quality level. A product hypothesis must never be backfilled as an observation.

## Candidate problem statements

### Validated problem statements

**[Unknown] No problem statement is validated in Phase 02.** A problem statement may be marked **validated** only after linked S0–S2 records support it across the relevant audience and the interpretation remains bounded by the evidence.

### Candidate statements under validation

| Candidate ID | Candidate problem statement | Audience | Current label | Evidence status | Validation needed |
|---|---|---|---|---|---|
| PS-01 | Early-career software talent may struggle to make the ability shown in real work legible before a hiring decision. | Talent and company | **[Assumption]** | No linked participant evidence | Current-state interviews and an observed proof-of-work task |
| PS-02 | Startups and small product teams may lack a consistent, trusted way to compare early-career software evidence beyond self-reported claims or presentation. | Company | **[Assumption]** | No linked participant evidence | Buyer interviews and blind evaluation of sample profiles |
| PS-03 | Reviewers may need transparent rubrics, conflict controls, and clear accountability to produce repeatable, trusted reviews. | Reviewer | **[Assumption]** | No linked participant evidence | Review simulation and reviewer interviews |
| PS-04 | Talent and companies may need explicit scope, compensation, and acceptance criteria for a paid trial to avoid uncertainty or unpaid production work. | Talent and company | **[Assumption]** | No linked participant evidence | Interviews plus a bounded pilot when approved |
| PS-05 | Participants may need a clear explanation of why a proof record is credible before they will rely on it. | Talent, company, and reviewer | **[Assumption]** | No linked participant evidence | Comprehension test using representative proof explanations |

These statements preserve the Phase 01 direction without asserting that the problems are frequent, severe, or already validated.

## Provisional priority pain points

### Ranking rule

**[Decision]** A ranked list is required for research planning, but no empirical severity or frequency values may be assigned before participant data exists. The ranking below is therefore a **provisional research-priority order**, based on consequence to the approved proof-to-opportunity loop and cross-role trust exposure. It is not an observed severity or frequency ranking and must be recalculated from participant evidence during beta.

### Top five pain points

| Research priority | Pain point | Affected audience | Severity | Frequency | Current label | Why this is prioritized | Evidence needed |
|---:|---|---|---|---|---|---|---|
| 1 | Real software work may be difficult to translate into credible, specific ability before a hiring decision. | Talent and company | **[Unknown] Unmeasured** | **[Unknown] Unmeasured** | **[Assumption]** | It sits at the start of the product promise and affects whether proof creates an opportunity. | TQ-01, TQ-02, CQ-01, CQ-02; S0–S2 records |
| 2 | Companies may not have a fair, consistent way to compare early-career evidence. | Company | **[Unknown] Unmeasured** | **[Unknown] Unmeasured** | **[Assumption]** | It determines whether evidence-led discovery can support a relevant contact without an opaque score. | CQ-01, CQ-02, CQ-04; blind evaluation evidence |
| 3 | Review quality, consistency, or conflicts may weaken trust in a proof record. | Reviewer, talent, and company | **[Unknown] Unmeasured** | **[Unknown] Unmeasured** | **[Assumption]** | Human review is the accountability layer that distinguishes proof from an unsupported claim. | RQ-01, RQ-02; review simulation evidence |
| 4 | Talent may need stronger control over what evidence becomes public and what remains restricted. | Talent and company | **[Unknown] Unmeasured** | **[Unknown] Unmeasured** | **[Assumption]** | Public visibility is necessary for discovery but can create privacy, attribution, or confidentiality risk. | TQ-04, TQ-05, CQ-05; consented privacy observations |
| 5 | Paid-trial scope, compensation, or acceptance terms may create uncertainty or unpaid-work risk. | Talent and company | **[Unknown] Unmeasured** | **[Unknown] Unmeasured** | **[Assumption]** | The paid transition is the loop's opportunity boundary and must remain fair and bounded. | TQ-03, CQ-03, CQ-05; pilot evidence when approved |

**[Unknown]** No claim can currently be made about which pain point is most severe or most frequent. The five entries are the current research priorities, not research results.

## Risk and assumption register

| ID | Risk or assumption | Affected audience | Label | Potential consequence | Current evidence | Mitigation and validation |
|---|---|---|---|---|---|---|
| RA-01 | Target talent may not complete a bounded proof task without unacceptable effort or facilitator support. | Talent | **[Assumption]** | The loop may fail before credible proof is created. | **[Unknown]** No observed task records | Run the planned observed workflow task; compare completion and rescue behavior against the existing 60% threshold in the validation hypothesis. |
| RA-02 | Companies may not trust reviewed evidence more than a portfolio alone. | Company | **[Assumption]** | Evidence-led discovery may not justify contact or hiring consideration. | **[Unknown]** No buyer evidence | Run a blind evaluation of sample profiles; retain the existing majority-preference threshold as a pending test. |
| RA-03 | Reviewers may not provide quality feedback for the proposed effort and incentive. | Reviewer | **[Assumption]** | Proof quality, capacity, and reviewer accountability may be insufficient. | **[Unknown]** No reviewer evidence | Run a review simulation and compensation interview; do not treat willingness to participate as validated until recorded. |
| RA-04 | A paid trial may fail to reduce uncertainty or may create unpaid production-work risk. | Talent and company | **[Assumption]** | The opportunity transition could create harm or erode trust. | **[Unknown]** No pilot or interview evidence | Test scope, compensation, and acceptance criteria in interviews and a bounded pilot only after market and policy approval. |
| RA-05 | Participants may not understand why a proof record is credible. | Talent, company, and reviewer | **[Assumption]** | Users may misinterpret or over-trust evidence and review signals. | **[Unknown]** No comprehension evidence | Conduct a comprehension test and record what explanation elements are understood or missed. |
| RA-06 | Public proof may expose confidential, identifying, or sensitive information without adequate user control. | Talent and company | **[Assumption]** | Privacy, attribution, and safety harm could result. | **[Evidence]** Phase 01 and security constraints require consent and restricted evidence; no participant preference data exists | Ask TQ-05 and CQ-05; preserve preview, consent, visibility, and restricted-material requirements. |
| RA-07 | Reviewer conflicts, collusion, or inconsistent standards may undermine proof integrity. | Reviewer, talent, and company | **[Assumption]** | False confidence, unfair outcomes, and disputes could increase. | **[Evidence]** Domain and security documents identify conflict and fake-review controls; no observed incidence data exists | Ask RQ-01 and RQ-02; test conflict scenarios and preserve independent human accountability. |

## Evidence status by core hypothesis

| Hypothesis ID | Hypothesis | Evidence required | Existing threshold or decision rule | Current status |
|---|---|---|---|---|
| H-01 | Junior developers will complete a bounded proof task. | Observed task completion and motivation interview | 60% complete without facilitator rescue | **[Assumption] Pending; no evidence** |
| H-02 | Companies trust reviewed evidence more than a portfolio alone. | Blind evaluation of sample profiles | Clear preference in the majority of target buyers | **[Assumption] Pending; no evidence** |
| H-03 | Reviewers will provide quality feedback for the proposed incentive. | Review simulation and compensation interview | Acceptable effort-to-reward ratio | **[Assumption] Pending; no evidence** |
| H-04 | Paid trials reduce uncertainty without creating unpaid labor. | Buyer and talent interviews plus a pilot | Both sides understand scope and value | **[Assumption] Pending; no evidence** |
| H-05 | Evidence explanations are understandable. | Comprehension test | Users identify why proof is credible | **[Assumption] Pending; no evidence** |

No hypothesis is **supported**, **mixed**, or **rejected** because no actual evidence record exists. The register uses the allowed statuses `assumption`, `supported`, `mixed`, `rejected`, and `deferred` only after linked evidence is available.

## User-language glossary

The glossary follows the canonical terminology in `DOMAIN_MODEL.md`. “Talent,” “company,” and “reviewer” describe roles a `Person` or `Organization` may take; they are not additional identity or reputation levels.

| Canonical term | Phase 02 usage | Avoid |
|---|---|---|
| **Person** | An authenticated human who may participate as talent, reviewer, company member, or administrator | Treating a role as a separate human account type |
| **Organization** | A company or team that creates projects, reviews talent, manages members, and pays for work | Using “company” as a database or identity synonym for every actor |
| **Talent** | The person role that submits real work and pursues an opportunity | “Candidate score,” “user quality,” or a universal rank |
| **Reviewer** | A qualified human who evaluates a `Submission` against a rubric | “AI reviewer” or an automated final verifier |
| **Skill** | A capability represented in the Proofly taxonomy with levels and evidence requirements | Treating activity count or a certificate as a verified skill by itself |
| **Project** | A defined piece of work with requirements, evaluation criteria, budget, and lifecycle | Calling every feed item a project |
| **Challenge** | A project intended to create comparable evidence across participants | Confusing a challenge with an unbounded job listing |
| **Submission** | A versioned set of work and explanation submitted for review | Treating a draft or claim as a completed submission |
| **Evidence item** | Work material that supports a submission and its provenance | Publishing private evidence by default |
| **Review** | A structured human evaluation of a submission against a rubric | Calling an AI suggestion a review decision |
| **Proof** | An evidence record linking a person, skill, submission, review, reviewer, and outcome | Using proof to mean identity assurance or a hidden score |
| **Proof Graph** | The connected history of skills, evidence, reviews, projects, outcomes, and endorsements | Reducing the graph to one popularity number |
| **Reputation event** | A traceable event that changes a reputation signal | Creating a reputation change without an auditable source event |
| **Application** | A talent request to participate in a project or opportunity | Treating an application as acceptance or hiring |
| **Paid trial** | A bounded paid engagement to evaluate collaboration before a larger contract | Unpaid production work, pay-to-apply, or an unbounded trial |
| **Contract** | An agreement defining parties, scope, milestones, payments, and status | Treating a message or application as a contract |
| **Dispute** | A structured case raised when a project, review, payment, or interaction is contested | Treating a report or AI flag as a final finding |

## Revised first-release workflow priorities

**[Decision]** No research-backed workflow change can be made yet because no participant evidence is recorded. The following priorities preserve and operationalize the Phase 01 workflow while making the research dependencies explicit. They are not evidence that users have completed or preferred the workflow.

| Priority | Workflow stage | Problem or trust requirement addressed | Research dependency | Status |
|---:|---|---|---|---|
| 1 | Choose a bounded software challenge or project | Test whether the work is relevant and worth completing for talent and useful to a startup | TQ-03, CQ-01, CQ-05; H-01 | **[Decision] Research-gated** |
| 2 | Submit a working solution with supporting evidence and explanation | Make a specific skill and its provenance inspectable without treating claims as proof | TQ-01, TQ-02, TQ-05; H-01 | **[Decision] Research-gated** |
| 3 | Receive qualified human review against a transparent rubric | Protect fairness, repeatability, conflict controls, and human accountability | TQ-04, RQ-01, RQ-02, RQ-03; H-03 | **[Decision] Trust requirement; pending validation** |
| 4 | Record eligible proof with an explicit visibility decision | Give companies useful discovery evidence while preserving privacy and consent | TQ-05, CQ-02, CQ-04; H-02, H-05 | **[Decision] Trust requirement; pending validation** |
| 5 | Discover relevant talent through explainable evidence | Test whether reviewed evidence is sufficient to justify contact | CQ-01, CQ-02, CQ-04; H-02, H-05 | **[Decision] Research-gated** |
| 6 | Start a bounded, compensated paid trial with clear scope and acceptance criteria | Reduce uncertainty without unpaid production work or pay-to-apply mechanics | TQ-03, CQ-03, CQ-05; H-04 | **[Decision] Policy- and research-gated** |
| 7 | Record an auditable outcome and assess repeat use | Test whether a completed opportunity strengthens the evidence loop without overstating reputation | TQ-03, CQ-03, CQ-04; H-04 | **[Unknown] Outcome and repeat-use evidence pending** |

Every proposed future feature must map to a recorded problem, a trust requirement, or a step in this core loop. A feature request without that mapping remains out of scope.

## Decision log

| Decision ID | Decision | Basis | Evidence status | Implication |
|---|---|---|---|---|
| D-01 | Keep the first niche limited to junior and early-career software talent, startups and small product teams, and experienced reviewers or mentors. | Locked Phase 01 direction and Phase 02 scope | **[Decision] Not user validation** | Do not broaden research or product scope prematurely. |
| D-02 | Treat all five core hypotheses and all candidate problem statements as unvalidated. | No participant evidence is present in the register | **[Evidence] Documentation audit; no user outcome** | Use assumption or unknown labels until linked research records exist. |
| D-03 | Preserve the evidence → human review → proof → paid opportunity chain as the first-release research frame. | Phase 01 product promise and domain trust invariants | **[Decision] Product direction, not validation** | Research must test the chain rather than add unrelated features. |
| D-04 | Keep AI assistive, transparent, source-linked, correctable, and subordinate to human decisions. | AI governance and Phase 01 product boundary | **[Decision] Policy constraint, not validation** | AI cannot be used as a research shortcut or final verifier. |
| D-05 | Do not make a research-backed workflow change in Phase 02 without actual participant evidence. | No S0–S2 records available | **[Decision] Research governance** | The workflow table remains provisional and research-gated. |
| D-06 | Do not assign empirical severity, frequency, cohort preference, or success beyond the existing pending thresholds. | No measured participant data | **[Decision] No-invention rule** | The priority list uses unknown values until beta evidence is collected. |

## Validation plan

### Collection plan

**[Decision]** Conduct the planned research in three cohorts: 5 junior or early-career software developers, 5 startup founders, engineering leads, or hiring managers, and 3 experienced reviewers or mentors. Use semi-structured interviews and one observed workflow task per participant. Ask about current behavior first, then show the smallest relevant Proofly concept.

**[Decision]** Assign a non-identifying participant ID. Capture date, role, context, method, moderator, consent and recording status, exact observations or compliant short quotes, a separate interpretation, confidence, decision affected, and follow-up validation. Store research materials outside the product repository in access-controlled storage according to the approved retention rules.

### Analysis plan

**[Decision]** Separate direct observation from interpretation. For each candidate pain point, record the number and proportion of relevant participants mentioning or demonstrating it, the observed consequence, the context, contradictory evidence, and confidence. Do not convert a participant's stated preference into an adoption forecast.

**[Decision]** Re-rank the five provisional pain points only after the evidence register contains comparable records. Severity must describe the observed consequence for the affected role, and frequency must describe the observed incidence in the defined cohort. Segment-specific findings must remain segment-specific.

### Audience validation matrix

| Audience | Methods | Required outputs | Decision gate |
|---|---|---|---|
| Talent | Current-state interview plus bounded proof-task observation | Evidence of current proof behavior, completion friction, trusted review language, and public/private boundaries | Decide whether the first proof workflow is understandable and worth testing further |
| Company | Current evaluation interview plus blind sample-profile evaluation | Evidence standards, credibility cues, contact threshold, paid-trial understanding, and adoption blockers | Decide whether evidence-led discovery merits a bounded pilot |
| Reviewer | Review simulation plus effort/incentive interview | Fairness and repeatability requirements, conflict controls, effort, and quality expectations | Decide whether a human-review pilot is safe and operationally legible |

### Hypothesis decision rules

**[Decision]** Use the existing Phase 02 thresholds without changing them: 60% completion without facilitator rescue for H-01; a clear preference in the majority of target buyers for H-02; an acceptable effort-to-reward ratio for H-03; both sides understanding paid-trial scope and value for H-04; and users identifying why proof is credible for H-05.

A result that does not meet a threshold is not hidden. It must be marked `mixed` or `rejected` as appropriate and create a documented scope or design decision. A result cannot be marked `supported` without linked evidence records.

## Remaining unknowns before beta

| Unknown | Audience | Why it matters | Planned validation |
|---|---|---|---|
| Whether a bounded proof task is motivating and completable without rescue | Talent | Determines whether the loop can generate evidence | H-01 observed task and interview |
| Which work context makes a portfolio or proof credible | Company | Determines what evidence can support responsible discovery | H-02 buyer evaluation and CQ-02/CQ-04 |
| What review language and process people trust | All three | Determines whether the proof chain is understandable and fair | TQ-04, RQ-01, RQ-02, H-05 |
| Whether reviewers will provide quality feedback under an approved incentive | Reviewer | Determines review capacity and accountability | H-03 simulation and interview |
| Whether paid trials reduce uncertainty without unpaid labor | Talent and company | Determines whether the loop can safely reach paid work | H-04 interview and bounded pilot |
| Which evidence must remain private or restricted | Talent and company | Determines consent, visibility, and confidentiality requirements | TQ-05 and CQ-05 |
| Whether the proposed language is understood across relevant backgrounds and locales | All three | Determines whether the product direction is accessible and portable | Comprehension test and later locale research |
| What repeat opportunity, if any, follows a first verified proof | Talent and company | Determines whether the loop creates durable value | Follow-up research after an approved pilot |

## Phase 02 completion summary

**[Evidence]** The current evidence base contains no participant research records.

**[Decision]** Phase 02 therefore completes the research-evidence structure, explicit audience questions, provisional problem-priority list, risk and assumption register, glossary, workflow priorities, decision log, and validation plan without claiming validation.

**[Unknown]** The ranked pain points are not yet evidence-backed by participant observations. Their severity, frequency, language, workflow fit, and effect on repeat use remain open.

**[Decision]** The next research step is to collect and link the planned consented interview and observed-task records before changing the product direction or broadening the first niche.
