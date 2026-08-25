import { BrandMark } from "@/components/marketing/brand-mark";
import { primaryNavItems } from "@/components/marketing/marketing-content";
import { ThemeToggle } from "@/components/marketing/theme-toggle";

export function MarketingNav() {
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
          <a className="nav-sign-in" href="/sign-in">
            Sign in
          </a>
          <a className="nav-cta" href="/get-started">
            Get started
          </a>
        </div>
      </nav>
    </header>
  );
}
