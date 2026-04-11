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
      className="sticky top-16 z-[5] -mx-4 mb-10 border-b border-zinc-200/70 bg-[rgba(250,250,250,0.82)] px-4 pb-6 pt-3 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-950 text-white shadow-[0_14px_30px_rgba(24,24,27,0.16)]">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950">{detail.item.filename}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              {fileTypeLabel(type)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {detail.file_size_bytes !== null ? formatFileSize(detail.file_size_bytes) : "Unknown size"}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {formatDate(detail.item.created_at)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button variant="secondary" type="button" onClick={onAskAi}>
            <Brain className="mr-2 h-4 w-4" />
            Ask AI
          </Button>
          <Button variant="soft" type="button" onClick={onSummarize}>
            <Sparkles className="mr-2 h-4 w-4" />
            Summarize
          </Button>
          <Button variant="ghost" type="button" onClick={() => window.open(downloadHref, "_blank", "noopener,noreferrer")}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
