import { BrandMark } from "@/components/marketing/brand-mark";
import { primaryNavItems } from "@/components/marketing/marketing-content";
import { ThemeToggle } from "@/components/marketing/theme-toggle";

export function MarketingNav() {
  return (
    <header className="marketing-nav">
      <nav className="nav-inner" aria-label="Primary navigation">
        <BrandMark />
        <div className="nav-links">
          {primaryNavItems.map(item => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <button
            type="button"
            className="nav-sign-in"
            disabled
            aria-describedby="sign-in-note"
          >
            Sign in
          </button>
          <span id="sign-in-note" className="sr-only">
            Sign in is an intentional Phase 09 placeholder. Authentication is
            not built in this phase.
          </span>
          <a className="nav-cta" href="#final-cta">
            Choose a role
          </a>
        </div>
      </nav>
    </header>
  );
}
