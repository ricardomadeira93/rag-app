"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { createConversation, deleteConversation, fetchConversations } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Conversation } from "@/lib/types";

type ConversationSidebarProps = {
  activeId: string | null;
  onSelect: (conversation: Conversation) => void;
  onNew: (conversation: Conversation) => void;
  /** Incrementing this counter triggers a list refresh (e.g. after first message) */
  refreshKey?: number;
};

export function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  refreshKey = 0,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const hasMounted = useRef(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!hasMounted.current) {
      hasMounted.current = true;
    }
    try {
      setConversations(await fetchConversations());
    } catch {
      // Non-fatal — sidebar just stays empty
    } finally {
      setLoading(false);
    }
  }

  async function handleNew() {
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      onNew(conv);
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // If we deleted the active conversation, signal parent with a null-ish new conv
      if (id === activeId) {
        const next = conversations.find((c) => c.id !== id);
        if (next) onSelect(next);
      }
    } catch {
      // ignore
    }
  }

  const confirmConversation = conversations.find((c) => c.id === confirmDeleteId) ?? null;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-ink">Conversations</span>
        <button
          id="new-conversation-btn"
          type="button"
          onClick={() => void handleNew()}
          title="New conversation"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-zinc-100 hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* List */}
      <nav className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="space-y-1 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted">No conversations yet.</p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  id={`conv-${conv.id}`}
                  type="button"
                  onClick={() => onSelect(conv)}
                  className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${
                    conv.id === activeId
                      ? "bg-zinc-100 text-ink"
                      : "text-muted hover:bg-zinc-50 hover:text-ink"
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{conv.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{formatDate(conv.updated_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(conv.id);
                    }}
                    className="invisible shrink-0 rounded p-0.5 text-muted hover:text-warning group-hover:visible"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Delete conversation?"
        description={confirmConversation ? `Delete "${confirmConversation.title}"?` : "Delete this conversation?"}
        confirmLabel="Delete conversation"
        tone="danger"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) {
            return;
          }
          const target = confirmDeleteId;
          setConfirmDeleteId(null);
          void handleDelete(target);
        }}
      />
    </aside>
  );
}
