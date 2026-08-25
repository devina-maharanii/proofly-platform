import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Eye,
  FileCode2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { MarketingNav } from "@/components/marketing/marketing-nav";
import { homepageCopy } from "@/components/marketing/marketing-content";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { ReviewRecord } from "@/components/marketing/review-record";

const REVIEW_FIELD = "/manus-storage/proofly-review-field_4754e723.jpg";
const TRUST_TOPOGRAPHY = "/manus-storage/proofly-trust-topography_22267c79.jpg";

function SectionEyebrow({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <p className="section-eyebrow">
      <span>{number}</span>
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <MarketingNav />

      <main id="main-content" className="site-root" tabIndex={-1}>
        <section className="hero page-shell">
          <div className="hero-copy">
            <Reveal>
              <SectionEyebrow number="01">
                Real work, made legible
              </SectionEyebrow>
            </Reveal>
            <Reveal>
              <h1>{homepageCopy.hero.headline}</h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="hero-description">
                {homepageCopy.hero.description}
              </p>
            </Reveal>
            <Reveal delay={0.12} className="hero-actions">
              <a
                className="button button-primary"
                href="/get-started?role=talent"
              >
                Build your proof <ArrowDownRight size={18} aria-hidden="true" />
              </a>
              <a
                className="button button-secondary"
                href="/get-started?role=company"
              >
                Hire from evidence <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="hero-note">
                Human review and public visibility are deliberate steps—not a
                score, not a guarantee.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="hero-preview-wrap">
            <div className="hero-atlas" aria-hidden="true" />
            <ProductPreview />
          </Reveal>
        </section>

        <section
          className="problem-section page-shell"
          aria-labelledby="problem-title"
        >
          <Reveal className="problem-statement">
            <SectionEyebrow number="02">The signal gap</SectionEyebrow>
            <h2 id="problem-title">
              A claim is not the same as work someone can understand.
            </h2>
          </Reveal>
          <Reveal delay={0.07} className="problem-detail">
            <p>
              Early-career developers can have serious ability without an easy
              way to show the decisions behind their work. Teams can see
              activity, presentation, or credentials without enough context to
              make a fair human judgment.
            </p>
            <p>
              Proofly is designed to connect the work, its provenance, a
              transparent review, and an accountable next step—without
              pretending that one score can settle suitability.
            </p>
            <a className="inline-link" href="#verification">
              Read what verification means{" "}
              <ArrowDownRight size={16} aria-hidden="true" />
            </a>
          </Reveal>
        </section>

        <section
          id="how-it-works"
          className="proof-section"
          aria-labelledby="proof-title"
        >
          <div className="page-shell proof-grid">
            <Reveal className="proof-intro">
              <SectionEyebrow number="03">The proof loop</SectionEyebrow>
              <h2 id="proof-title">
                From work in progress to a more understandable opportunity.
              </h2>
              <p>
                Every stage keeps the relevant person, source, and limit
                visible. The sequence is a product direction—not a promise of
                employment.
              </p>
            </Reveal>
            <div className="proof-rail">
              {homepageCopy.proofSteps.map((step, index) => (
                <Reveal
                  key={step.number}
                  delay={index * 0.035}
                  className="proof-step"
                >
                  <div className="proof-step-number">{step.number}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section
          id="talent"
          className="talent-section page-shell"
          aria-labelledby="talent-title"
        >
          <Reveal className="talent-aside">
            <SectionEyebrow number="04">For talent</SectionEyebrow>
            <p className="role-caption">Your work deserves context.</p>
            <div className="talent-index" aria-label="Talent proof priorities">
              <span>Work</span>
              <span>Review</span>
              <span>Control</span>
            </div>
          </Reveal>
          <Reveal delay={0.06} className="talent-body">
            <h2 id="talent-title">Show the thinking behind what you build.</h2>
            <p>
              Use a bounded project to make a specific skill easier to inspect.
              Receive useful feedback, revise when needed, and choose what
              eligible proof becomes public.
            </p>
            <ul className="check-list">
              <li>
                <Check size={18} aria-hidden="true" /> Work versions keep their
                context.
              </li>
              <li>
                <Check size={18} aria-hidden="true" /> Feedback names the rubric
                and next step.
              </li>
              <li>
                <Check size={18} aria-hidden="true" /> Private evidence stays
                restricted by default.
              </li>
            </ul>
            <a className="button button-primary" href="#final-cta">
              Build your proof <ArrowDownRight size={18} aria-hidden="true" />
            </a>
          </Reveal>
        </section>

        <section
          id="companies"
          className="company-section"
          aria-labelledby="companies-title"
        >
          <div className="page-shell company-layout">
            <Reveal className="company-image-wrap">
              <Image
                className="company-image"
                src={REVIEW_FIELD}
                alt="Abstract review field with layered graphite surfaces and a cobalt evidence route."
                width={1200}
                height={900}
                sizes="(max-width: 900px) 100vw, 45vw"
                loading="lazy"
              />
              <div className="company-image-label">
                <span aria-hidden="true" />
                Human judgment stays accountable
              </div>
              <ReviewRecord />
            </Reveal>
            <Reveal delay={0.08} className="company-copy">
              <SectionEyebrow number="05">For companies</SectionEyebrow>
              <h2 id="companies-title">
                Inspect relevant evidence before you decide.
              </h2>
              <p>
                Define realistic work, see the review context around a
                submission, and keep your hiring judgment human. When the market
                and policy support it, a fair paid trial gives both parties a
                bounded way to evaluate collaboration.
              </p>
              <div className="company-principles">
                <div>
                  <span>01</span>
                  <p>See work context, not only profile claims.</p>
                </div>
                <div>
                  <span>02</span>
                  <p>Understand the review, source, and uncertainty.</p>
                </div>
                <div>
                  <span>03</span>
                  <p>Use explicit scope and compensation for paid work.</p>
                </div>
              </div>
              <a className="button button-secondary" href="#final-cta">
                Hire from evidence <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </Reveal>
          </div>
        </section>

        <section
          id="verification"
          className="verification-section page-shell"
          aria-labelledby="verification-title"
        >
          <Reveal className="verification-heading">
            <SectionEyebrow number="06">Verification, explained</SectionEyebrow>
            <h2 id="verification-title">
              Trust is a chain people can inspect.
            </h2>
          </Reveal>
          <div className="verification-ledger">
            <Reveal delay={0.04} className="ledger-item">
              <span className="ledger-icon">
                <FileCode2 size={19} aria-hidden="true" />
              </span>
              <div>
                <h3>Specific work</h3>
                <p>
                  A proof points to an exact submission version and the source
                  context behind it.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="ledger-item">
              <span className="ledger-icon">
                <UsersRound size={19} aria-hidden="true" />
              </span>
              <div>
                <h3>Qualified human review</h3>
                <p>
                  A reviewer works against a transparent rubric, with conflict
                  and feedback context.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.12} className="ledger-item">
              <span className="ledger-icon">
                <Eye size={19} aria-hidden="true" />
              </span>
              <div>
                <h3>Controlled visibility</h3>
                <p>
                  Proof is not public by default. People choose what eligible
                  context becomes visible.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.16} className="ledger-item">
              <span className="ledger-icon">
                <ShieldCheck size={19} aria-hidden="true" />
              </span>
              <div>
                <h3>Correction and revocation</h3>
                <p>
                  A valid chain can be revised or revoked without erasing the
                  accountable history.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="trust-section" aria-labelledby="trust-title">
          <div className="page-shell trust-layout">
            <Reveal className="trust-copy">
              <SectionEyebrow number="07">Privacy & limits</SectionEyebrow>
              <h2 id="trust-title">
                Proof should be useful without becoming surveillance.
              </h2>
              <p>
                Private source files, messages, financial terms, and trust cases
                are not public proof. Identity assurance, reviewer approval,
                work verification, payout eligibility, and hiring suitability
                remain separate signals.
              </p>
              <div className="trust-tags">
                <span>
                  <LockKeyhole size={15} aria-hidden="true" /> Private by
                  default
                </span>
                <span>
                  <Fingerprint size={15} aria-hidden="true" /> Human
                  accountability
                </span>
                <span>
                  <Sparkles size={15} aria-hidden="true" /> AI is advisory only
                </span>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="trust-image-wrap">
              <Image
                className="trust-image"
                src={TRUST_TOPOGRAPHY}
                alt="Abstract evidence topography showing a cobalt route across privacy boundaries."
                width={1350}
                height={900}
                sizes="(max-width: 900px) 100vw, 48vw"
                loading="lazy"
              />
            </Reveal>
          </div>
        </section>

        <section
          id="final-cta"
          className="final-section page-shell"
          aria-labelledby="final-title"
        >
          <Reveal className="final-card">
            <p className="section-eyebrow">
              <span>08</span>Choose your next context
            </p>
            <h2 id="final-title">
              Start with a role. Keep the evidence visible.
            </h2>
            <p>
              Create and verify an account first. Role-specific workflows begin
              only after their own approved phases.
            </p>
            <div className="final-actions">
              <a
                className="button button-primary"
                href="/get-started?role=talent"
              >
                Build your proof <ArrowDownRight size={18} aria-hidden="true" />
              </a>
              <a
                className="button button-secondary"
                href="/get-started?role=company"
              >
                Hire from evidence <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
            <p className="final-note">
              Account creation is role-neutral. Selecting an interest does not
              authorize a product role.
            </p>
          </Reveal>
        </section>
      </main>

      <footer className="marketing-footer page-shell">
        <div className="footer-brand">
          <span className="footer-signal" /> Proofly <span>Working name</span>
        </div>
        <p>Credibility earned through evidence.</p>
        <a href="#top">
          Back to top <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </footer>
    </>
  );
}
