"use client";

import { motion } from "framer-motion";
import { CornerDownRight, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

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
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="mx-auto flex max-w-[680px] flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <Sparkles className="h-[18px] w-[18px]" />
          </div>
          <h1 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">How can I help?</h1>
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
          />

          {message.role === "assistant" && message.sources && message.sources.length > 0 ? (
            <div className="ml-8 flex flex-wrap gap-2">
              {message.sources.map((source, sourceIndex) => (
                <SourceCard key={`${source.id}-${sourceIndex}`} source={source} />
              ))}
            </div>
          ) : null}

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
