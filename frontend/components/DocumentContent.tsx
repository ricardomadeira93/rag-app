"use client";

import { motion } from "framer-motion";
import { Copy, FileSearch } from "lucide-react";
import { useMemo } from "react";

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

  if (!content) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-500">
          <FileSearch className="h-6 w-6" />
        </div>
        <p className="mt-5 text-lg font-medium text-zinc-950">No extracted text available</p>
        <p className="mt-2 max-w-lg text-base leading-8 text-zinc-500">
          This document was indexed, but readable content is not available yet. Try downloading the original file or asking AI to work from the indexed chunks.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={springTransition}
      className="document-prose pb-24"
    >
      {type === "audio" ? <AudioPlayer src={`/api/documents/${detail.item.id}/file`} title={detail.item.filename} /> : null}
      {type === "audio" ? <SectionLabel>Transcript</SectionLabel> : null}
      {type === "pdf" ? <SectionLabel>Extracted text</SectionLabel> : null}
      {renderBlocks(blocks)}
    </motion.div>
  );
}

function renderBlocks(blocks: MarkdownBlock[]) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-10 text-4xl font-semibold tracking-tight text-zinc-950"
              : block.level === 2
                ? "mt-10 text-2xl font-semibold tracking-tight text-zinc-950"
                : "mt-8 text-xl font-semibold tracking-tight text-zinc-900";

          return (
            <motion.div
              key={`heading-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springTransition, delay: Math.min(index * 0.03, 0.18) }}
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
      // Ignore clipboard failures in unsupported environments.
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: Math.min(index * 0.03, 0.18) }}
      className="group -mx-3 rounded-2xl px-3 py-1"
    >
      <div className="flex items-start gap-4">
        <p className="flex-1 whitespace-pre-wrap text-[17px] leading-[1.8] text-zinc-700">{text}</p>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => void handleCopy()}
          className="mt-1 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-8 text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
      {children}
    </div>
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
