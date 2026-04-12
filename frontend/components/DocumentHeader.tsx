"use client";

import { motion } from "framer-motion";
import { Brain, CalendarDays, Download, FileAudio2, FileImage, FileText, FileType2, ScrollText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fileTypeLabel, formatFileSize, normalizeDocumentType } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import type { DocumentDetail } from "@/lib/types";

type DocumentHeaderProps = {
  detail: DocumentDetail;
  onAskAi: () => void;
  onSummarize: () => void;
};

const springTransition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
} as const;

export function DocumentHeader({ detail, onAskAi, onSummarize }: DocumentHeaderProps) {
  const type = normalizeDocumentType(detail.item.file_type);
  const Icon = type === "audio" ? FileAudio2 : type === "image" ? FileImage : type === "pdf" ? FileType2 : FileText;
  const downloadHref = `/api/documents/${detail.item.id}/file`;

  return (
    <motion.header
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="sticky top-16 z-[5] -mx-4 border-b border-[var(--border-soft)] bg-[var(--bg-surface)]/85 px-4 pb-4 pt-3 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            <Icon className="h-4 w-4" />
          </div>
          <h1 className="max-w-3xl text-[18px] font-semibold tracking-tight text-[var(--text-primary)]">{detail.item.filename}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <ScrollText className="h-3 w-3" />
              {fileTypeLabel(type)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {detail.file_size_bytes !== null ? formatFileSize(detail.file_size_bytes) : "Unknown size"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" />
              {formatDate(detail.item.created_at)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" type="button" onClick={onAskAi} className="h-7 text-[12px] px-3">
            <Brain className="mr-1.5 h-3 w-3" />
            Ask AI
          </Button>
          <Button variant="soft" type="button" onClick={onSummarize} className="h-7 text-[12px] px-3">
            <Sparkles className="mr-1.5 h-3 w-3" />
            Summarize
          </Button>
          <Button variant="ghost" type="button" onClick={() => window.open(downloadHref, "_blank", "noopener,noreferrer")} className="h-7 text-[12px] px-3">
            <Download className="mr-1.5 h-3 w-3" />
            Download
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
