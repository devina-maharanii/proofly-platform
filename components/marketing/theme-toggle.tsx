"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("proofly-theme", nextTheme);
    applyTheme(nextTheme);
  }

  const nextLabel =
    theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === "light" ? (
        <Moon size={16} aria-hidden="true" />
      ) : (
        <Sun size={16} aria-hidden="true" />
      )}
      <span className="theme-toggle-label">Theme</span>
    </button>
  );
}
