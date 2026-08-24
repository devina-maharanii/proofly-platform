// Phase 10 public foundation: keep the theme control named, keyboard-native, persistent, and available before client hydration.
const themeControlScript = `
  (() => {
    const storageKey = "proofly-theme";
    const control = document.getElementById("theme-toggle");

    if (!control) return;

    const applyTheme = (theme) => {
      const nextLabel = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
      control.setAttribute("aria-label", nextLabel);
      control.setAttribute("title", nextLabel);
    };

    const storedTheme = window.localStorage.getItem(storageKey);
    applyTheme(storedTheme === "dark" ? "dark" : "light");

    control.addEventListener("click", () => {
      const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";

      window.localStorage.setItem(storageKey, nextTheme);
      applyTheme(nextTheme);
    });
  })();
`;

export function ThemeToggle() {
  return (
    <>
      <button
        id="theme-toggle"
        type="button"
        className="theme-toggle"
        aria-label="Switch to dark theme"
        title="Switch to dark theme"
      >
        <svg
          className="theme-icon theme-icon-moon"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
        <svg
          className="theme-icon theme-icon-sun"
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <span className="theme-toggle-label">Theme</span>
      </button>
      <script dangerouslySetInnerHTML={{ __html: themeControlScript }} />
    </>
  );
}
