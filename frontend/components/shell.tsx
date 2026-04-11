"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.getElementById("workspace-search-input") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
      if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        router.push("/chat");
      }
      if (meta && event.key.toLowerCase() === "u") {
        event.preventDefault();
        router.push("/documents/upload");
      }
      if (event.key === "Escape") {
        const active = document.activeElement as HTMLElement | null;
        active?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="flex min-h-screen shell-surface">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 px-5 py-5 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
