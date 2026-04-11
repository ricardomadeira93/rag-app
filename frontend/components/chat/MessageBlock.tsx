"use client";

import { motion } from "framer-motion";
import { Copy, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";

import type { ChatMessage } from "@/lib/types";

type MessageBlockProps = {
  kind: "user" | "assistant";
  message: ChatMessage;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onSave?: () => void;
};

export function MessageBlock({
  kind,
  message,
  isStreaming = false,
  onCopy,
  onRegenerate,
}: MessageBlockProps) {
  const isUser = kind === "user";

  return (
    <motion.article
      initial={isUser ? { opacity: 0, x: 12 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: isUser ? 0.15 : 0.2 }}
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex max-w-[75%] gap-2 ${isUser ? "justify-end" : "items-start"}`}>
        {!isUser ? (
          <div className="mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            <Sparkles className="h-[11px] w-[11px]" />
          </div>
        ) : null}

        <div className="space-y-2">
          <div
            className={`relative overflow-hidden ${
              isUser
                ? "rounded-[12px] rounded-tl-[16px] bg-[var(--bg-active)] px-[14px] py-[10px] text-[var(--text-primary)]"
                : "rounded-[12px] rounded-tr-[16px] border border-[var(--border-soft)] bg-[var(--bg-surface)] px-[14px] py-[10px] text-[var(--text-secondary)]"
            }`}
          >
            {!isUser ? <div className="absolute inset-y-0 left-0 w-[2px] rounded-full bg-[var(--accent)]" /> : null}
            <div className={`${isUser ? "" : "pl-2"} space-y-2`}>
              {renderContent(message.content || (isStreaming ? "Thinking…" : ""), isUser)}
            </div>
          </div>

          {!isUser ? (
            <div className="flex translate-y-1 items-center gap-3 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
              <ActionButton label="Copy" icon={<Copy className="h-3 w-3" />} onClick={onCopy} />
              <ActionButton label="Helpful" icon={<ThumbsUp className="h-3 w-3" />} />
              <ActionButton label="Not helpful" icon={<ThumbsDown className="h-3 w-3" />} />
              <ActionButton label="Regenerate" icon={<RefreshCw className="h-3 w-3" />} onClick={onRegenerate} />
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
    >
      {icon}
    </button>
  );
}

type ContentBlock =
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] }
  | { type: "code"; content: string }
  | { type: "heading"; content: string };

function renderContent(content: string, isUser: boolean) {
  const blocks = parseContent(content);
  const paragraphClass = isUser ? "text-[13px] leading-[1.6] text-[var(--text-primary)]" : "text-[13px] leading-[1.6] text-[var(--text-secondary)]";

  return blocks.map((block, index) => (
    <div key={`${block.type}-${index}`}>
      {block.type === "heading" ? (
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{block.content}</p>
      ) : null}
      {block.type === "paragraph" ? <p className={`whitespace-pre-wrap ${paragraphClass}`}>{block.content}</p> : null}
      {block.type === "list" ? (
        <ul className="space-y-1.5">
          {block.items.map((item) => (
            <li key={item} className={`flex gap-2 ${paragraphClass}`}>
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-muted)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {block.type === "code" ? (
        <pre className="overflow-x-auto rounded bg-[var(--bg-raised)] px-3 py-2 text-[12px] leading-5 text-[var(--text-primary)]">
          <code>{block.content}</code>
        </pre>
      ) : null}
    </div>
  ));
}

function parseContent(content: string): ContentBlock[] {
  const lines = content.split("\n");
  const blocks: ContentBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  function flushParagraph() {
    const joined = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      blocks.push({ type: "paragraph", content: joined });
    }
    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  }

  function flushCode() {
    if (codeBuffer.length > 0) {
      blocks.push({ type: "code", content: codeBuffer.join("\n") });
      codeBuffer = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", content: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(trimmed.slice(2));
      continue;
    }
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: "paragraph", content: content.trim() });
  }

  return blocks;
}
