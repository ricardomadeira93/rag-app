"use client";

import { motion } from "framer-motion";
import {
  AlignLeft,
  AlertCircle,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FileUp,
  Hash,
  Info,
  List,
  MessageSquare,
  PenLine,
  RefreshCw,
  Circle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SourceCard } from "@/components/SourceCard";
import { RESPONSE_MODE_OPTIONS, type ChatMessage, type DocumentRecord, type ResponseMode } from "@/lib/types";

type MessageBlockProps = {
  kind: "user" | "assistant";
  message: ChatMessage;
  allDocuments?: DocumentRecord[];
  isStreaming?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onSave?: () => void;
  onRate?: (rating: 1 | -1) => void;
  onSwitchMode?: (mode: ResponseMode) => void;
};

export function MessageBlock({
  kind,
  message,
  allDocuments = [],
  isStreaming = false,
  onCopy,
  onRegenerate,
  onRate,
  onSwitchMode,
}: MessageBlockProps) {
  const isUser = kind === "user";
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const showNudge = !isUser && !isStreaming && message.confidence === "none" && message.answerType !== "workspace";
  const isComparison = !isUser && message.answerType === "comparison";
  const analyzedDocuments = message.analyzedDocuments ?? message.sources?.length ?? 0;
  const totalDocuments = message.totalDocuments ?? analyzedDocuments;
  const modeOption = RESPONSE_MODE_OPTIONS.find((option) => option.value === (message.modeUsed ?? "answer")) ?? RESPONSE_MODE_OPTIONS[0];

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
            <Circle className="h-[11px] w-[11px]" />
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
              {!isUser && message.modeAutoDetected ? (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <ModeIcon icon={modeOption.icon} className="h-3 w-3" />
                  <span>Responding in {modeOption.label} mode</span>
                  {onSwitchMode ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setModeMenuOpen((current) => !current)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-[var(--text-secondary)]"
                      >
                        <span>· Switch</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {modeMenuOpen ? (
                        <div className="absolute left-0 top-5 z-20 w-[220px] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
                          {RESPONSE_MODE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setModeMenuOpen(false);
                                onSwitchMode(option.value);
                              }}
                              className={`flex h-8 w-full items-center gap-2 px-3 text-left text-[12px] transition-colors hover:bg-[var(--bg-subtle)] ${
                                option.value === message.modeUsed ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "text-[var(--text-secondary)]"
                              }`}
                            >
                              <ModeIcon icon={option.icon} className="h-3.5 w-3.5 shrink-0" />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isComparison && analyzedDocuments > 0 ? (
                <div className="text-[11px] text-[var(--text-muted)]">
                  Analyzed {analyzedDocuments} document{analyzedDocuments === 1 ? "" : "s"}
                </div>
              ) : null}
              {isComparison && message.comparisonTruncated ? (
                <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-[11px] leading-5 text-[var(--text-secondary)]">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        Showing {analyzedDocuments} of {totalDocuments} documents
                      </div>
                      <div>
                        {message.comparisonMessage || "Name specific documents to compare them in depth. e.g. Compare WORKFLOW.md and Design.md"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {message.isThinking ? (
                <ThinkingStatus hasSources={Boolean(message.sources && message.sources.length > 0)} />
              ) : (
                renderResponseContent(message, isUser, allDocuments)
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
                {sourcesCount > 0 && !isComparison ? (
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
                {message.modeUsed ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      <ModeIcon icon={modeOption.icon} className="h-3 w-3" />
                      {modeOption.label}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })() : null}

          {!isUser && sourcesExpanded && message.sources && message.sources.length > 0 ? (
            isComparison ? (
              <div className="ml-6 mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
                <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span>View all {message.sources.length} sources</span>
                  <button
                    type="button"
                    onClick={() => setSourcesExpanded(false)}
                    className="hover:text-[var(--text-secondary)] transition-colors"
                  >
                    ‹ Hide
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {message.sources.map((source, sourceIndex) => (
                    <Link
                      key={`${source.id}-${sourceIndex}`}
                      href={`/documents/${source.document_id}`}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)] ${
                        relevanceClasses(source.similarity_score)
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-[12px] font-medium">{source.filename}</span>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium">
                          {Math.round(source.similarity_score * 100)}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ml-6 mt-2 flex flex-col gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                {message.sources.map((source, sourceIndex) => (
                  <SourceCard key={`${source.id}-${sourceIndex}`} source={source} />
                ))}
              </div>
            )
          ) : null}

          {!isUser && isComparison && !sourcesExpanded && message.sources && message.sources.length > 0 ? (
            <div className="ml-6 mt-2">
              <button
                type="button"
                onClick={() => setSourcesExpanded(true)}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
              >
                View all {message.sources.length} sources <ChevronRight className="h-3 w-3" />
              </button>
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

function ModeIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case "AlignLeft":
      return <AlignLeft className={className} />;
    case "List":
      return <List className={className} />;
    case "CheckSquare":
      return <CheckSquare className={className} />;
    case "Calendar":
      return <Calendar className={className} />;
    case "PenLine":
      return <PenLine className={className} />;
    case "AlertCircle":
      return <AlertCircle className={className} />;
    default:
      return <MessageSquare className={className} />;
  }
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

function relevanceClasses(similarity: number) {
  if (similarity >= 0.7) {
    return "border-green-200 bg-green-50 text-green-800";
  }
  if (similarity >= 0.5) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-secondary)]";
}

function renderResponseContent(message: ChatMessage, isUser: boolean, allDocuments: DocumentRecord[]) {
  if (!isUser && message.modeUsed === "action_items") {
    return <ActionItemsView content={message.content} allDocuments={allDocuments} />;
  }
  if (!isUser && message.modeUsed === "timeline") {
    return <TimelineView content={message.content} allDocuments={allDocuments} />;
  }
  return renderContent(message.content, isUser, allDocuments);
}

function renderContent(content: string, isUser: boolean, allDocuments: DocumentRecord[]) {
  const renderedContent = preprocessContent(content, allDocuments);
  const textClass = isUser ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]";

  return (
    <div className={`space-y-3 text-[13px] leading-6 ${textClass}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap leading-7">{children}</p>,
          h1: ({ children }) => <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">{children}</h1>,
          h2: ({ children }) => <h2 className="pt-1 text-[15px] font-semibold text-[var(--text-primary)]">{children}</h2>,
          h3: ({ children }) => <h3 className="pt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 marker:text-[var(--text-muted)]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 marker:font-medium marker:text-[var(--text-muted)]">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--border-strong)] pl-4 text-[var(--text-muted)]">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[12px] text-[var(--text-primary)]">{children}</code>
            ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--bg-raised)] px-3 py-3 text-[12px] leading-6 text-[var(--text-primary)]">
              {children}
            </pre>
          ),
          a: ({ href, children }) => {
            if (!href) {
              return <span>{children}</span>;
            }
            if (href.startsWith("/")) {
              return (
                <Link href={href as any} className="font-medium text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-text)]">
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-text)]">
                {children}
              </a>
            );
          },
        }}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}

function ActionItemsView({ content, allDocuments }: { content: string; allDocuments: DocumentRecord[] }) {
  const items = extractChecklistItems(content);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(items.map(() => false));

  useEffect(() => {
    setCheckedItems(items.map(() => false));
  }, [items]);

  async function handleCopyUnchecked() {
    const unchecked = items.filter((_, index) => !checkedItems[index]).map((item) => `- ${item}`);
    if (unchecked.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(unchecked.join("\n"));
  }

  function handleExport() {
    const blob = new Blob([items.map((item) => `- [ ] ${item}`).join("\n")], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, "action-items.md");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleCopyUnchecked()} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Copy className="h-3 w-3" />
          Copy as list
        </button>
        <button type="button" onClick={handleExport} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Download className="h-3 w-3" />
          Export
        </button>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <label
              key={`${item}-${index}`}
              className={`flex items-start gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[13px] ${
                checkedItems[index] ? "bg-[var(--bg-subtle)] text-[var(--text-muted)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
              }`}
            >
              <input
                type="checkbox"
                checked={checkedItems[index] || false}
                onChange={() =>
                  setCheckedItems((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)))
                }
                className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--border-soft)]"
              />
              <span className={checkedItems[index] ? "line-through" : ""}>{item}</span>
            </label>
          ))}
        </div>
      ) : (
        renderContent(content, false, allDocuments)
      )}
    </div>
  );
}

function TimelineView({ content, allDocuments }: { content: string; allDocuments: DocumentRecord[] }) {
  const events = extractTimelineItems(content);

  function handleExport() {
    const lines = events.length > 0 ? events.map((event) => `${event.date} — ${event.description}${event.source ? ` — ${event.source}` : ""}`) : [content];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "timeline.txt");
  }

  if (events.length === 0) {
    return renderContent(content, false, allDocuments);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={handleExport} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Download className="h-3 w-3" />
          Export timeline
        </button>
      </div>
      <div className="relative space-y-3 pl-4">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-[var(--border-soft)]" />
        {events.map((event, index) => (
          <div key={`${event.date}-${index}`} className="relative rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2">
            <div className={`absolute -left-[10px] top-4 h-2.5 w-2.5 rounded-full ${timelineDotClass(event.date)}`} />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${timelinePillClass(event.date)}`}>{event.date}</span>
              {event.source ? <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{event.source}</span> : null}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{event.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function extractChecklistItems(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\[ \]|^- \[ \]|^\d+\./.test(line))
    .map((line) => line.replace(/^\[ \]\s*/, "").replace(/^- \[ \]\s*/, "").replace(/^\d+\.\s*/, "").trim());
}

function extractTimelineItems(content: string): Array<{ date: string; description: string; source: string | null }> {
  const items: Array<{ date: string; description: string; source: string | null } | null> = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[?([^\]]+)\]?\s+[-—]\s+(.+?)(?:\s+[-—]\s+(\[[^\]]+\]|.+))?$/);
      if (!match) {
        return null;
      }
      return {
        date: match[1].trim(),
        description: match[2].trim(),
        source: match[3]?.trim() ?? null,
      };
    });

  return items.filter((item): item is { date: string; description: string; source: string | null } => item !== null);
}

function timelineDotClass(date: string) {
  const lower = date.toLowerCase();
  if (lower.includes("upcoming") || lower.includes("after") || lower.includes("q") || /\b20[3-9]\d\b/.test(lower)) {
    return "bg-green-500";
  }
  if (lower.includes("current") || lower.includes("today") || lower.includes("this")) {
    return "bg-blue-500";
  }
  return "bg-zinc-400";
}

function timelinePillClass(date: string) {
  const lower = date.toLowerCase();
  if (lower.includes("upcoming") || lower.includes("after") || lower.includes("q") || /\b20[3-9]\d\b/.test(lower)) {
    return "bg-green-50 text-green-700";
  }
  if (lower.includes("current") || lower.includes("today") || lower.includes("this")) {
    return "bg-blue-50 text-blue-700";
  }
  return "bg-zinc-100 text-zinc-700";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function preprocessContent(content: string, allDocuments: DocumentRecord[]) {
  return content.replace(/\[@([^\]]+)\]|\[#([^\]]+)\]/g, (match, docLabel: string | undefined, tagLabel: string | undefined) => {
    if (docLabel) {
      const document = allDocuments.find((item) => item.filename === docLabel);
      return document ? `[${docLabel}](/documents/${document.id})` : `\`@${docLabel}\``;
    }

    if (tagLabel) {
      return `[#${tagLabel}](/documents?tag=${encodeURIComponent(tagLabel)})`;
    }

    return match;
  });
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
