import { BrandMark } from "@/components/marketing/brand-mark";
/** Evidence Ledger Editorial: role-aware navigation uses concrete proof-language and exposes only server-derived context labels. */
import { primaryNavItems } from "@/components/marketing/marketing-content";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { getRoleContext } from "@/lib/roles/context";

export async function MarketingNav() {
  const context = await getRoleContext();
  const contextLabel =
    context?.active?.role === "company_member"
      ? (context.memberships.find(
          membership =>
            membership.organizationId === context.active?.organizationId
        )?.organizationName ?? "Organization")
      : context?.active?.role === "reviewer"
        ? "Reviewer"
        : context?.active?.role === "administrator"
          ? "Administrator"
          : context?.active?.role === "talent"
            ? "Talent"
            : null;

  return (
    <header className="marketing-nav">
      <nav className="nav-inner" aria-label="Primary navigation">
        <BrandMark />
        <div className="nav-navigation">
          <div className="nav-links">
            {primaryNavItems.map(item => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          <details className="mobile-menu">
            <summary>Menu</summary>
            <div className="mobile-menu-list">
              {primaryNavItems.map(item => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </details>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          {context ? (
            <a className="nav-sign-in" href="/auth/continue">
              {contextLabel ? `${contextLabel} context` : "Choose context"}
            </a>
          ) : (
            <a className="nav-sign-in" href="/sign-in">
              Sign in
            </a>
          )}
          <a
            className="nav-cta"
            href={context ? "/auth/continue" : "/get-started"}
          >
            {context ? "Switch context" : "Build your proof"}
          </a>
        </div>
      </nav>
    </header>
  );
}
