"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceSearch } from "@/components/workspace-search";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border-soft)] bg-[var(--bg-page)] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <WorkspaceSearch />
        <ThemeToggle />
      </div>
    </header>
  );
}

