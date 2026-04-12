"use client";

import { motion } from "framer-motion";
import { CornerDownRight, FileText, Sparkles, X, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, useEffect } from "react";

import { MessageBlock } from "@/components/chat/MessageBlock";
import { SourceCard } from "@/components/SourceCard";
import type { ChatMessage, DocumentRecord } from "@/lib/types";

type MessageListProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  workspaceName?: string;
  suggestions: string[];
  recentDocuments: DocumentRecord[];
  onCopyAssistant: (index: number) => void;
  onRegenerate: (index: number) => void;
  onSaveAssistant: (index: number) => void;
  onSuggestionClick: (value: string) => void;
  onRate?: (index: number, rating: 1 | -1) => void;
};

export function MessageList({
  messages,
  isStreaming,
  workspaceName = "Workspace",
  suggestions,
  recentDocuments,
  onCopyAssistant,
  onRegenerate,
  onSuggestionClick,
  onRate,
}: MessageListProps) {
  const [hintsDismissed, setHintsDismissed] = useState(true); // default true to avoid hydration flash
  
  useEffect(() => {
    setHintsDismissed(window.localStorage.getItem("hints_dismissed") === "true");
  }, []);

  function handleDismissHints() {
    setHintsDismissed(true);
    window.localStorage.setItem("hints_dismissed", "true");
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="mx-auto flex max-w-[680px] flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <Sparkles className="h-[18px] w-[18px]" />
          </div>
          <h2 className="mt-6 text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">You don&apos;t have any context</h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">{workspaceName}</p>

          <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="panel p-3 text-left text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)]"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {recentDocuments.length > 0 ? (
            <div className="mt-6 w-full">
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">Recent files</p>
              <div className="flex flex-wrap justify-center gap-2">
                {recentDocuments.slice(0, 3).map((document) => (
                  <Link
                    key={document.id}
                    href={`/documents/${document.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-[11px] text-[var(--text-secondary)]"
                  >
                    <FileText className="h-[11px] w-[11px]" />
                    <span className="max-w-[180px] truncate">{document.filename}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {!hintsDismissed ? (
            <div className="mt-8 flex flex-col items-center gap-2 w-full animate-in fade-in duration-500">
              <div className="relative rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3 pl-4 pr-10 w-full max-w-[380px] shadow-sm">
                <button 
                  onClick={handleDismissHints}
                  className="absolute right-2 top-2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded" 
                  title="Dismiss hints"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    <span>Try asking me to compare two documents</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    <span>Ask what&apos;s missing from a source</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    <span>Scope your search to specific files using the [+]</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-4 pb-48 pt-8">
      {messages.map((message, index) => (
        <Fragment key={`${message.role}-${index}`}>
          <MessageBlock
            kind={message.role === "user" ? "user" : "assistant"}
            message={message}
            isStreaming={isStreaming && message.role === "assistant" && index === messages.length - 1}
            onCopy={message.role === "assistant" ? () => onCopyAssistant(index) : undefined}
            onRegenerate={message.role === "assistant" ? () => onRegenerate(index) : undefined}
            onSave={message.role === "assistant" ? () => undefined : undefined}
            onRate={message.role === "assistant" && onRate ? (rating: 1 | -1) => onRate(index, rating) : undefined}
          />

          {message.role === "assistant" && index === messages.length - 1 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="ml-8 flex flex-wrap gap-2"
            >
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]"
                >
                  <CornerDownRight className="h-[11px] w-[11px] text-[var(--text-muted)]" />
                  {suggestion}
                </button>
              ))}
            </motion.div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
