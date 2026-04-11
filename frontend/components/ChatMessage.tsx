import { motion } from "framer-motion";
import { Bot, CircleDashed, UserRound } from "lucide-react";

import type { ChatMessage as ChatMessageData } from "@/lib/types";

type ChatMessageProps = {
  message: ChatMessageData;
  isStreaming?: boolean;
};

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser ? (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-zinc-500 shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div className={`min-w-0 ${isUser ? "max-w-[78%]" : "max-w-[82%]"}`}>
        <div className={`${isUser ? "workspace-surface bg-white/85 px-4 py-3" : "px-1 py-1"}`}>
          <div className="mb-2 flex items-center gap-2">
            {isUser ? <UserRound className="h-3.5 w-3.5 text-zinc-400" /> : <CircleDashed className="h-3.5 w-3.5 text-zinc-400" />}
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{isUser ? "You" : "Assistant"}</p>
          </div>
          <div className="space-y-3 text-sm leading-7 text-ink">
            {renderStructuredContent(message.content || (isStreaming ? "Thinking..." : ""))}
          </div>
        </div>

        {!isUser && message.debug ? (
          <div className="mt-4 workspace-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Debug</p>
              <span className="badge">{message.debug.embedding_model}</span>
            </div>
            <div className="mt-3 space-y-3">
              {message.debug.chunks.map((chunk) => (
                <div key={chunk.id} className="rounded-xl bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{chunk.filename}</p>
                    <span className="text-xs text-muted">
                      sim {chunk.similarity_score.toFixed(2)} / score {chunk.score.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{chunk.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isUser ? (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <UserRound className="h-4 w-4" />
        </div>
      ) : null}
    </motion.article>
  );
}

function renderStructuredContent(content: string) {
  const lines = content.split("\n");
  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={`spacer-${index}`} className="h-1" />;
    }

    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={index} className="pt-2 text-base font-semibold text-zinc-900">
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    }

    if (trimmed.startsWith("- ")) {
      return (
        <div key={index} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
          <p className="text-sm leading-7 text-zinc-700">{trimmed.slice(2)}</p>
        </div>
      );
    }

    return (
      <p key={index} className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">
        {line}
      </p>
    );
  });
}
