"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  ChevronRight,
  LayoutDashboard,
  Library,
  MessageSquare,
  Pin,
  Plug,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConversationContextMenu } from "@/components/chat/ConversationContextMenu";
import {
  fetchConversations,
  fetchSettings,
  fetchWorkspaces,
  deleteConversation,
  renameConversation,
  selectWorkspace,
  togglePin,
  fetchSources,
} from "@/lib/api";
import type { Conversation, Workspace } from "@/lib/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chats", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: Library },
  { href: "/sources", label: "Sources", icon: Plug },
] as const;

const transition = { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } as const;

type ContextMenuState = {
  conversationId: string;
  position: { x: number; y: number };
} | null;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("Local RAG");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("default");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeSourcesCount, setActiveSourcesCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  useEffect(() => {
    void fetchSettings()
      .then((settings) => {
        setWorkspaceName(settings.workspace_name || "Local RAG");
        setActiveWorkspaceId(settings.current_workspace_id || "default");
      })
      .catch(() => null);
    void fetchWorkspaces()
      .then((items) => setWorkspaces(items))
      .catch(() => setWorkspaces([]));
    void fetchConversations()
      .then((items) => setConversations(items))
      .catch(() => setConversations([]));
    void fetchSources()
      .then((items) => setActiveSourcesCount(items.filter(i => i.status === "syncing" || i.status === "connected").length))
      .catch(() => setActiveSourcesCount(0));
  }, []);

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.pinned),
    [conversations],
  );
  const recentConversations = useMemo(
    () => conversations.filter((c) => !c.pinned).slice(0, 12),
    [conversations],
  );
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "L";

  async function handleWorkspaceSelect(workspaceId: string) {
    try {
      const selected = await selectWorkspace(workspaceId);
      setActiveWorkspaceId(selected.id);
      setWorkspaceMenuOpen(false);
      window.location.href = "/dashboard";
    } catch {
      // Ignore
    }
  }

  async function handleDeleteChat() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteConversation(confirmDeleteId);
      setConversations((prev) => prev.filter((c) => c.id !== confirmDeleteId));
      if (pathname === `/chat/${confirmDeleteId}`) {
        router.push("/chat");
      }
    } catch {
      // Ignore
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const handleRename = useCallback(async (id: string, newTitle: string) => {
    try {
      const updated = await renameConversation(id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c)),
      );
    } catch {
      // Ignore
    }
  }, []);

  const handleTogglePin = useCallback(async (id: string) => {
    try {
      const updated = await togglePin(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, pinned: updated.pinned } : c)),
      );
    } catch {
      // Ignore
    }
  }, []);

  function handleContextMenu(e: React.MouseEvent, conversationId: string) {
    e.preventDefault();
    setContextMenu({ conversationId, position: { x: e.clientX, y: e.clientY } });
  }

  const contextConversation = contextMenu
    ? conversations.find((c) => c.id === contextMenu.conversationId)
    : null;

  const confirmConversation = conversations.find((c) => c.id === confirmDeleteId) ?? null;

  function renderConversationItem(conversation: Conversation, index: number) {
    const isActive = pathname === `/chat/${conversation.id}`;
    return (
      <motion.div
        key={conversation.id}
        initial={{ x: -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...transition, delay: index * 0.03 }}
        className="group relative"
        onContextMenu={(e) => handleContextMenu(e, conversation.id)}
      >
        <Link
          href={`/chat/${conversation.id}`}
          title={conversation.title}
          className={`ml-7 flex h-7 items-center justify-between rounded-lg px-2 text-[12px] transition-colors pr-6 ${
            isActive
              ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <span className="truncate">{conversation.title}</span>
          {conversation.pinned ? (
            <Pin className="ml-1 h-2.5 w-2.5 shrink-0 text-[var(--accent)] opacity-60" />
          ) : null}
        </Link>
      </motion.div>
    );
  }

  return (
    <aside className="hidden min-h-screen w-[220px] shrink-0 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] md:flex md:flex-col">
      <div className="flex h-full flex-col px-3 py-4">
        <div className="flex items-start justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((current) => !current)}
              className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-[var(--bg-subtle)]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{workspaceName || "Local RAG"}</p>
                <p className="text-[11px] text-[var(--text-muted)]">Workspace</p>
              </div>
            </button>
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

        <AnimatePresence>
          {workspaceMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)]"
            >
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => void handleWorkspaceSelect(workspace.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] ${
                    workspace.id === activeWorkspaceId ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <nav className="mt-6 space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const content = (
              <>
                <div className="flex items-center gap-[10px]">
                  <Icon className="h-[15px] w-[15px]" />
                  <span>{item.label}</span>
                </div>
                {item.href === "/sources" && activeSourcesCount > 0 && (
                  <div className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-medium text-white">
                    {activeSourcesCount}
                  </div>
                )}
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
                        <div className="mt-1 space-y-0.5">
                          {/* Pinned conversations */}
                          {pinnedConversations.length > 0 ? (
                            <>
                              <p className="ml-8 mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                                Pinned
                              </p>
                              {pinnedConversations.map((c, i) => renderConversationItem(c, i))}
                              {recentConversations.length > 0 ? (
                                <p className="ml-8 mt-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                                  Recent
                                </p>
                              ) : null}
                            </>
                          ) : null}

                          {/* Recent conversations */}
                          {recentConversations.map((c, i) =>
                            renderConversationItem(c, i + pinnedConversations.length),
                          )}

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
              <Link key={item.href} href={item.href} className={`sidebar-item flex justify-between w-[calc(100%-16px)] ${active ? "sidebar-item-active" : ""}`}>
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

      {/* Context Menu */}
      {contextMenu && contextConversation ? (
        <ConversationContextMenu
          conversationId={contextMenu.conversationId}
          conversationTitle={contextConversation.title}
          isPinned={contextConversation.pinned}
          position={contextMenu.position}
          onRename={(id, title) => void handleRename(id, title)}
          onTogglePin={(id) => void handleTogglePin(id)}
          onDelete={(id) => setConfirmDeleteId(id)}
          onClose={() => setContextMenu(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete chat?"
        description={confirmConversation ? `Permanently delete "${confirmConversation.title}"?` : "Permanently delete this chat?"}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => void handleDeleteChat()}
      />
    </aside>
  );
}
