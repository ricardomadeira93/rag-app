"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Copy, FileSearch, FileText, LayoutGrid, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { normalizeDocumentType } from "@/lib/documents";
import type { DocumentDetail } from "@/lib/types";

type DocumentContentProps = {
  detail: DocumentDetail;
};

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; content: string }
  | { type: "paragraph"; content: string };

const springTransition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
} as const;

export function DocumentContent({ detail }: DocumentContentProps) {
  const type = normalizeDocumentType(detail.item.file_type);
  const content = detail.content?.trim() ?? "";
  const blocks = useMemo(() => parseMarkdownLikeContent(content), [content]);

  // Tab State: "native" | "extraction"
  const [activeTab, setActiveTab] = useState<"native" | "extraction">("native");

  if (!content && type !== "pdf" && type !== "image" && type !== "audio") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
          <FileSearch className="h-6 w-6" />
        </div>
        <p className="mt-5 text-lg font-medium text-[var(--text-primary)]">No content available</p>
        <p className="mt-2 max-w-lg text-base leading-8 text-[var(--text-secondary)]">
          This document was indexed, but readable content could not be retrieved. Try downloading the original file or asking AI.
        </p>
      </motion.div>
    );
  }

  const fileUrl = `/api/documents/${detail.item.id}/file`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={springTransition}
      className="pb-24 pt-8"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mb-6 flex items-center gap-6 border-b border-zinc-200">
            <button
              onClick={() => setActiveTab("native")}
              className={`flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors ${
                activeTab === "native"
                  ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <FileText className="h-4 w-4" />
              Original File
            </button>
            <button
              onClick={() => setActiveTab("extraction")}
              className={`flex items-center gap-2 border-b-2 pb-3 text-[13px] font-medium transition-colors ${
                activeTab === "extraction"
                  ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              RAG Extraction
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="min-h-[500px]"
            >
              {activeTab === "native" && (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-sm overflow-hidden min-h-[400px]">
                  {type === "pdf" ? (
                    <iframe src={`${fileUrl}#view=FitH`} className="w-full h-[85vh] border-none" title={detail.item.filename} />
                  ) : type === "image" ? (
                    <div className="p-4 bg-[var(--bg-subtle)] flex items-center justify-center min-h-[400px]">
                      <img src={fileUrl} alt={detail.item.filename} className="max-w-full rounded-xl object-contain" />
                    </div>
                  ) : type === "audio" ? (
                    <div className="p-8 bg-[var(--bg-subtle)] flex items-center justify-center min-h-[400px]">
                      <div className="w-full max-w-md">
                        <p className="text-center text-sm font-medium text-[var(--text-primary)] mb-6">{detail.item.filename}</p>
                        <AudioPlayer src={fileUrl} title={detail.item.filename} />
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 lg:p-12">
                      <div className="prose prose-zinc dark:prose-invert prose-sm sm:prose-base max-w-none text-[var(--text-secondary)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "extraction" && (
                <div className="document-prose max-w-none">
                  {ExtractedBlocksView(blocks)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="space-y-4">
          {detail.item.conflicting_docs.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                <div>
                  <p className="text-[12px] font-semibold text-amber-900">Potential contradictions</p>
                  <div className="mt-2 space-y-2">
                    {detail.item.conflicting_docs.map((conflict) => (
                      <Link
                        key={`${conflict.doc_id}-${conflict.reason}`}
                        href={`/chat?documents=${detail.item.id},${conflict.doc_id}&prompt=${encodeURIComponent(`Find conflicts between ${detail.item.filename} and ${conflict.filename}`)}`}
                        className="block rounded-lg bg-white/80 px-3 py-2 text-[12px] text-amber-900"
                      >
                        <div className="font-medium">{conflict.filename}</div>
                        {conflict.reason ? <div className="mt-1 text-amber-800">{conflict.reason}</div> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {detail.item.related_docs.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[var(--text-muted)]" />
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Documents related to this one</p>
              </div>
              <div className="mt-3 space-y-2">
                {detail.item.related_docs.map((related) => (
                  <Link
                    key={related.doc_id}
                    href={`/documents/${related.doc_id}`}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  >
                    <span className="truncate">{related.filename}</span>
                    <span>{Math.round((related.similarity ?? 0) * 100)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </motion.div>
  );
}

function ExtractedBlocksView(blocks: MarkdownBlock[]) {
  if (blocks.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[13px] text-[var(--text-muted)]">No extracted paragraphs found for this document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-8 text-2xl font-semibold tracking-tight text-[var(--text-primary)]"
              : block.level === 2
                ? "mt-6 text-xl font-semibold tracking-tight text-[var(--text-primary)]"
                : "mt-4 text-base font-semibold tracking-tight text-[var(--text-secondary)]";

          return (
            <motion.div
              key={`heading-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springTransition, delay: Math.min(index * 0.02, 0.1) }}
            >
              {block.level === 1 ? (
                <h1 className={className}>{block.content}</h1>
              ) : block.level === 2 ? (
                <h2 className={className}>{block.content}</h2>
              ) : (
                <h3 className={className}>{block.content}</h3>
              )}
            </motion.div>
          );
        }

        return <CopyableParagraph key={`paragraph-${index}`} text={block.content} index={index} />;
      })}
    </div>
  );
}

function CopyableParagraph({ text, index }: { text: string; index: number }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: Math.min(index * 0.02, 0.1) }}
      className="group -mx-3 rounded-2xl px-3 py-2 transition-colors hover:bg-[var(--bg-subtle)]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-soft)]" />
        <p className="flex-1 whitespace-pre-wrap text-[13px] leading-[1.7] text-[var(--text-secondary)]">{text}</p>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => void handleCopy()}
          className="opacity-0 transition-opacity group-hover:opacity-100 h-8 text-[11px]"
        >
          <Copy className="mr-1.5 h-3 w-3" />
          Copy
        </Button>
      </div>
    </motion.div>
  );
}

function parseMarkdownLikeContent(content: string): MarkdownBlock[] {
  const lines = content.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    const joined = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      blocks.push({ type: "paragraph", content: joined });
    }
    paragraphBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 3, content: trimmed.replace(/^###\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 2, content: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "heading", level: 1, content: trimmed.replace(/^#\s+/, "") });
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  return blocks;
}
