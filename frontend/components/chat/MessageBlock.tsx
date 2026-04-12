"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Copy, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, FileUp } from "lucide-react";
import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";

import { SourceCard } from "@/components/SourceCard";
import type { ChatMessage } from "@/lib/types";

type MessageBlockProps = {
  kind: "user" | "assistant";
  message: ChatMessage;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onSave?: () => void;
  onRate?: (rating: 1 | -1) => void;
};

export function MessageBlock({
  kind,
  message,
  isStreaming = false,
  onCopy,
  onRegenerate,
  onRate,
}: MessageBlockProps) {
  const isUser = kind === "user";
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const showNudge = !isUser && !isStreaming && message.confidence === "none" && message.answerType !== "workspace";

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
              {message.isThinking ? (
                <ThinkingStatus hasSources={Boolean(message.sources && message.sources.length > 0)} />
              ) : (
                renderContent(message.content, isUser)
              )}
            </div>
          </div>

          {/* Meta row: confidence + sources + answer type */}
          {!isUser && !message.isThinking ? (() => {
            const sourcesCount = message.sources?.length || 0;
            const confidence = message.confidence || (sourcesCount >= 3 ? "high" : sourcesCount === 2 ? "medium" : sourcesCount === 1 ? "low" : "none");
            return (
              <div className="ml-6 flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                <ConfidenceBadge confidence={confidence} count={sourcesCount} />
                <ConfidenceLabel confidence={confidence} />
                {sourcesCount > 0 ? (
                  <>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setSourcesExpanded(!sourcesExpanded)}
                      className="hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {sourcesCount} source{sourcesCount !== 1 ? "s" : ""} {sourcesExpanded ? "▾" : "›"}
                    </button>
                  </>
                ) : null}
                <span>·</span>
                <AnswerTypePill answerType={message.answerType} confidence={confidence} sourcesCount={sourcesCount} />
              </div>
            );
          })() : null}

          {!isUser && sourcesExpanded && message.sources && message.sources.length > 0 ? (
            <div className="ml-6 mt-2 flex flex-col gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
              {message.sources.map((source, sourceIndex) => (
                <SourceCard key={`${source.id}-${sourceIndex}`} source={source} />
              ))}
            </div>
          ) : null}

          {showNudge ? (
            <div className="ml-6 mt-2 animate-in fade-in duration-300">
              <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-3 max-w-[340px]">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-[var(--danger)]">
                    <FileUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-[12px] font-medium text-[var(--text-primary)]">No matches in your docs</h4>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-snug">
                      To answer this better, try uploading:<br />
                      <span className="italic">&quot;Meeting notes, project briefs, or related specs&quot;</span>
                    </p>
                    <Link
                      href="/documents/upload"
                      className="mt-2 inline-flex text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent-text)]"
                    >
                      Upload files &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isUser && !message.isThinking ? (
            <div className="flex translate-y-1 items-center gap-3 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
              <ActionButton label="Copy" icon={<Copy className="h-3 w-3" />} onClick={onCopy} />
              <ActionButton 
                label="Helpful" 
                icon={<ThumbsUp className={`h-3 w-3 ${message.rating === 1 ? 'fill-current' : ''}`} />} 
                onClick={onRate ? () => onRate(1) : undefined} 
                isActive={message.rating === 1}
              />
              <ActionButton 
                label="Not helpful" 
                icon={<ThumbsDown className={`h-3 w-3 ${message.rating === -1 ? 'fill-current' : ''}`} />} 
                onClick={onRate ? () => onRate(-1) : undefined} 
                isActive={message.rating === -1}
              />
              <ActionButton label="Regenerate" icon={<RefreshCw className="h-3 w-3" />} onClick={onRegenerate} />
            </div>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function ActionButton({ label, icon, onClick, isActive }: { label: string; icon: ReactNode; onClick?: () => void; isActive?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[11px] transition-colors ${
        isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
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

function ConfidenceBadge({ confidence, count }: { confidence: "high"|"medium"|"low"|"none" | undefined, count: number }) {
  if (!confidence) return null;
  
  const config = {
    high:   { dots: 4, color: "bg-[#16a34a]" },
    medium: { dots: 3, color: "bg-[#d97706]" },
    low:    { dots: 2, color: "bg-[#dc2626]" },
    none:   { dots: 1, color: "bg-[#9ca3af]" }
  };
  
  const current = config[confidence];
  
  return (
    <div className="flex items-center gap-0.5" title={`${count} sources`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= current.dots ? current.color : "bg-zinc-200 dark:bg-zinc-700"}`}
        />
      ))}
    </div>
  );
}

function ConfidenceLabel({ confidence }: { confidence: "high"|"medium"|"low"|"none" }) {
  const labels = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    none: "No context"
  };
  return <span>{labels[confidence]}</span>;
}

function AnswerTypePill({ answerType, confidence, sourcesCount }: { answerType?: string, confidence?: string, sourcesCount: number }) {
  let label = "General knowledge";
  let classes = "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  
  if (answerType === "workspace") {
    label = "From workspace";
    classes = "bg-[var(--accent-light)] text-[var(--accent-text)]";
  } else if (sourcesCount > 0) {
    if (confidence === "high" || confidence === "medium") {
      label = "From your documents";
      classes = "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
    } else {
      label = "Partial match";
      classes = "bg-[var(--bg-subtle)] text-[var(--text-muted)]";
    }
  } else if (confidence === "none") {
    label = "Not found";
    classes = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  }
  
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${classes}`}>
      {label}
    </span>
  );
}

function ThinkingStatus({ hasSources }: { hasSources: boolean }) {
  const [phase, setPhase] = useState("Searching your documents...");
  
  useEffect(() => {
    if (hasSources) {
      setPhase("Reading sources...");
      return;
    }
    
    const t = setTimeout(() => {
      setPhase("Reviewing knowledge base...");
    }, 800);
    
    return () => clearTimeout(t);
  }, [hasSources]);
  
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] italic">
      <span className="flex gap-1 animate-pulse">
        <span className="h-1 w-1 bg-[var(--text-muted)] rounded-full"></span>
        <span className="h-1 w-1 bg-[var(--text-muted)] rounded-full animation-delay-150"></span>
        <span className="h-1 w-1 bg-[var(--text-muted)] rounded-full animation-delay-300"></span>
      </span>
      {phase}
    </div>
  );
}
