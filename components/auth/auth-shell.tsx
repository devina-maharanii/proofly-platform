/** Proofly Phase 11 auth shell: a focused, role-neutral account surface in the approved precision-editorial system. */
import type { ReactNode } from "react";
import Link from "next/link";

import { ThemeToggle } from "@/components/marketing/theme-toggle";

type AuthShellProps = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>;

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link className="auth-brand" href="/" aria-label="Proofly home">
          <span className="auth-brand-mark" aria-hidden="true" />
          <span>
            Proofly <small>/ evidence</small>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <main id="main-content" className="auth-main" tabIndex={-1}>
        <section className="auth-intro" aria-labelledby="auth-page-title">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-page-title">{title}</h1>
          <p>{description}</p>
          <ul className="auth-ledger" aria-label="Account safeguards">
            <li>
              <strong>01</strong>
              <span>
                Account access is separate from any role or public proof.
              </span>
            </li>
            <li>
              <strong>02</strong>
              <span>Verification and recovery remain under your control.</span>
            </li>
            <li>
              <strong>03</strong>
              <span>
                Signing in does not make private work or identity data public.
              </span>
            </li>
          </ul>
        </section>
        <section className="auth-card" aria-label="Account action">
          <p className="auth-evidence-stamp">
            <span aria-hidden="true">●</span> account boundary · private by
            default
          </p>
          {children}
        </section>
      </main>
    </div>
  );
}
