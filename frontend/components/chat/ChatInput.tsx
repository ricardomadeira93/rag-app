"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Paperclip, Plus, Send, Zap } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";

import { AttachmentChips } from "@/components/chat/AttachmentChips";
import type { DocumentRecord } from "@/lib/types";

type ChatInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  attachedDocuments: DocumentRecord[];
  availableDocuments: DocumentRecord[];
  modelLabel?: string;
  semanticRouting?: boolean;
  recommendedModels?: string[];
  onModelChange?: (model: string) => void;
  onToggleRouting?: (enabled: boolean) => void;
  onRemoveAttachment: (id: string) => void;
  onAddAttachment: (document: DocumentRecord) => void;
};

export function ChatInput({
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  loading = false,
  attachedDocuments,
  availableDocuments,
  modelLabel = "Active model",
  semanticRouting,
  recommendedModels,
  onModelChange,
  onToggleRouting,
  onRemoveAttachment,
  onAddAttachment,
}: ChatInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const attachableDocuments = useMemo(
    () =>
      availableDocuments
        .filter((document) => document.status === "indexed")
        .filter((document) => !attachedDocuments.some((attached) => attached.id === document.id))
        .slice(0, 8),
    [attachedDocuments, availableDocuments],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void onSubmit();
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 left-0 md:left-[220px] z-20 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto w-full max-w-[680px] rounded-t-2xl border-t border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-3">
        <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
          <AttachmentChips documents={attachedDocuments} onRemove={onRemoveAttachment} />

          <AnimatePresence>
            {pickerOpen && attachableDocuments.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                className="border-b border-[var(--border-soft)] py-2"
              >
                {attachableDocuments.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => {
                      onAddAttachment(document);
                      setPickerOpen(false);
                    }}
                    className="flex h-8 w-full items-center justify-between px-4 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <span className="truncate">{document.filename}</span>
                    <Plus className="h-3 w-3" />
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="px-4 py-3">
            <textarea
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={1}
              placeholder="Ask about your documents..."
              className="min-h-[28px] w-full resize-none border-none bg-transparent text-[13px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              style={{ maxHeight: "120px" }}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Attach document"
                  onClick={() => setPickerOpen((current) => !current)}
                  disabled={availableDocuments.length === 0}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>

                {onToggleRouting && semanticRouting !== undefined && (
                  <button
                    type="button"
                    title="Semantic Routing (Automatic Mode)"
                    onClick={() => onToggleRouting(!semanticRouting)}
                    className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      semanticRouting
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Zap className={`h-3 w-3 ${semanticRouting ? "fill-white/20" : ""}`} />
                    Auto
                  </button>
                )}

                {onModelChange && recommendedModels ? (
                  <div className="relative flex items-center">
                    <select
                      value={modelLabel}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="h-6 w-full cursor-pointer appearance-none rounded-full bg-[var(--bg-subtle)] pl-3 pr-7 text-[11px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--line-subtle)] hover:text-[var(--text-primary)]"
                    >
                      {!recommendedModels.includes(modelLabel) && <option value={modelLabel}>{modelLabel}</option>}
                      {recommendedModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-[var(--text-muted)]" />
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">{modelLabel}</span>
                )}
              </div>

              <button
                type="button"
                disabled={disabled || loading || value.trim().length === 0}
                onClick={() => void onSubmit()}
                className="button-primary h-8 w-8 rounded-full p-0"
                title="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
