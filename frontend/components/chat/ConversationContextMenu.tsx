"use client";

import { Pin, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ConversationContextMenuProps = {
  conversationId: string;
  conversationTitle: string;
  isPinned: boolean;
  position: { x: number; y: number };
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function ConversationContextMenu({
  conversationId,
  conversationTitle,
  isPinned,
  position,
  onRename,
  onTogglePin,
  onDelete,
  onClose,
}: ConversationContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversationTitle);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  function submitRename() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === conversationTitle) {
      setIsRenaming(false);
      setDraftTitle(conversationTitle);
      return;
    }
    onRename(conversationId, trimmed);
    onClose();
  }

  return (
    <div
      ref={rootRef}
      className="fixed z-50 min-w-[220px] rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-1.5 shadow-xl"
      style={{ top: position.y, left: position.x }}
    >
      {isRenaming ? (
        <div className="space-y-2 p-2">
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitRename();
              }
              if (event.key === "Escape") {
                setIsRenaming(false);
                setDraftTitle(conversationTitle);
              }
            }}
            className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-base)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] outline-none"
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setIsRenaming(false);
                setDraftTitle(conversationTitle);
              }}
              className="rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRename}
              className="rounded-md bg-[var(--accent)] px-2 py-1 text-[11px] text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsRenaming(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              onTogglePin(conversationId);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <Pin className="h-3.5 w-3.5" />
            {isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(conversationId);
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      )}
    </div>
  );
}
