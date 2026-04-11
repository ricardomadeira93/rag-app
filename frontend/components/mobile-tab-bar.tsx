"use client";

import { LayoutDashboard, Library, MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/chat", icon: MessageSquare, label: "Chats" },
  { href: "/documents", icon: Library, label: "Documents" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border-soft)] bg-[var(--bg-surface)]/95 pb-safe backdrop-blur md:hidden">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
              active ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
