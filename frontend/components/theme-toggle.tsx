"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  applyThemePreference,
  persistThemePreference,
  readStoredThemePreference,
  resolveThemePreference,
  type ThemePreference,
} from "@/lib/ui-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("light");

  useEffect(() => {
    const stored = readStoredThemePreference();
    const resolved = resolveThemePreference(stored);
    setTheme(resolved);
  }, []);

  function handleToggle() {
    const nextTheme: ThemePreference = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    persistThemePreference(nextTheme);
  }

  useEffect(() => {
    const stored = readStoredThemePreference();
    if (stored) {
      applyThemePreference(stored);
    }
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
