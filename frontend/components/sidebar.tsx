"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  LayoutDashboard,
  Library,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { fetchConversations, fetchSettings } from "@/lib/api";
import type { Conversation } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chats", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: Library },
] as const;

const transition = { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("Local RAG");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatsOpen, setChatsOpen] = useState(true);

  useEffect(() => {
    void fetchSettings()
      .then((settings) => setWorkspaceName(settings.workspace_name || "Local RAG"))
      .catch(() => null);
    void fetchConversations()
      .then((items) => setConversations(items))
      .catch(() => setConversations([]));
  }, []);

  const recentConversations = useMemo(() => conversations.slice(0, 6), [conversations]);
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "L";

  return (
    <aside className="hidden min-h-screen w-[220px] shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] md:flex md:flex-col">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="flex items-start justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{workspaceName || "Local RAG"}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              title="New chat"
              aria-label="New chat"
              onClick={() => router.push("/chat")}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const content = (
              <>
                <Icon className="h-[15px] w-[15px]" />
                <span>{item.label}</span>
              </>
            );

            if (item.href === "/chat") {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/chat");
                      setChatsOpen((current) => !current);
                    }}
                    className={`sidebar-item w-[calc(100%-16px)] justify-between ${active ? "sidebar-item-active" : ""}`}
                  >
                    <span className="flex items-center gap-[10px]">{content}</span>
                    <motion.span animate={{ rotate: chatsOpen ? 90 : 0 }} transition={transition}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {chatsOpen ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={transition}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-1">
                          {recentConversations.map((conversation, index) => (
                            <motion.div
                              key={conversation.id}
                              initial={{ x: -8, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ ...transition, delay: index * 0.03 }}
                            >
                              <Link
                                href={`/chat/${conversation.id}`}
                                title={conversation.title}
                                className="ml-7 flex h-7 items-center rounded-lg px-2 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]"
                              >
                                <span className="truncate">{conversation.title.slice(0, 22)}</span>
                              </Link>
                            </motion.div>
                          ))}
                          <button
                            type="button"
                            onClick={() => router.push("/chat")}
                            className="ml-7 flex h-7 items-center rounded-lg px-2 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--accent-text)]"
                          >
                            + New chat
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={`sidebar-item ${active ? "sidebar-item-active" : ""}`}>
                {content}
              </Link>
            );
          })}

          <Link
            href="/settings"
            className={`sidebar-item ${pathname === "/settings" || pathname.startsWith("/settings/") ? "sidebar-item-active" : ""}`}
          >
            <Settings className="h-[15px] w-[15px]" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="mt-6 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-3 text-[12px] leading-5 text-[var(--text-muted)]">
          Reading stays calm in Chat. Source files stay organized in Documents.
        </div>

        <div className="mt-auto pt-4">
          <div className="mb-3 border-t border-[var(--sidebar-border)]" />
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-medium text-white">
                N
              </div>
              <span className="text-[12px] text-[var(--text-secondary)]">Local RAG</span>
            </div>
            <Link
              href="/settings"
              title="Settings"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
