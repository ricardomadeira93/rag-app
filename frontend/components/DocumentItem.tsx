"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Loader2, MoreHorizontal, RefreshCw, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FileIcon } from "@/components/FileIcon";
import { fileTypeLabel, normalizeDocumentType } from "@/lib/documents";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import type { DocumentRecord } from "@/lib/types";

type DocumentItemProps = {
  document: DocumentRecord;
  deleting?: boolean;
  expanded?: boolean;
  onToggle?: (id: string) => void;
  onDelete: (id: string) => void;
};

const fadeUp = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
} as const;

export function DocumentItem({
  document,
  deleting = false,
  expanded = false,
  onToggle,
  onDelete,
}: DocumentItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const type = normalizeDocumentType(document.file_type);

  return (
    <motion.article variants={fadeUp} initial="hidden" animate="visible" className={`${deleting ? "opacity-50" : ""}`}>
      <div
        className="grid h-9 cursor-pointer grid-cols-[20px,minmax(0,1fr),72px,120px,64px,82px,28px] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--bg-subtle)]"
        onClick={() => onToggle?.(document.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onToggle?.(document.id);
          }
        }}
      >
        <FileIcon type={type} className="h-[14px] w-[14px]" />
        <span className="truncate text-[13px] text-[var(--text-primary)]" title={document.filename}>
          {document.filename}
        </span>
        <span className="badge justify-self-start">{fileTypeLabel(type)}</span>
        <StatusBadge status={document.status} />
        <span className="text-right text-[11px] text-[var(--text-muted)]">
          {document.file_size_bytes > 0 ? formatBytes(document.file_size_bytes) : "—"}
        </span>
        <span className="text-right text-[11px] text-[var(--text-muted)]">{formatRelativeTime(document.created_at)}</span>
        <button
          type="button"
          title="Delete"
          aria-label={`Delete ${document.filename}`}
          onClick={(event) => {
            event.stopPropagation();
            setConfirmDelete((current) => !current);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {confirmDelete ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-2 mt-1 flex items-center justify-between rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-light)] px-3 py-2">
              <p className="text-[12px] text-[var(--danger)]">Delete this document and its indexed chunks?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="button-ghost h-7 px-2 text-[12px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(document.id)}
                  disabled={deleting}
                  className="button-primary h-7 bg-[var(--danger)] px-2 text-[12px] hover:bg-[var(--danger)]"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-2 mt-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-4">
              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="space-y-3">
                  {document.summary ? (
                    <div>
                      <p className="section-label">Summary</p>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{document.summary}</p>
                    </div>
                  ) : null}
                  {document.error_message ? (
                    <div>
                      <p className="section-label">Error</p>
                      <p className="mt-2 text-[12px] text-[var(--danger)]">{document.error_message}</p>
                    </div>
                  ) : null}
                  {document.topics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {document.topics.slice(0, 8).map((topic) => (
                        <span key={topic} className="badge">
                          {topic}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="section-label">Actions</p>
                  <Link href={`/documents/${document.id}`} className="button-secondary w-full justify-start">
                    Open reader
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function StatusBadge({ status }: { status: DocumentRecord["status"] }) {
  if (status === "indexed") {
    return (
      <span className="badge status-badge-success">
        <CheckCircle className="h-2.5 w-2.5" />
        Indexed
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="badge status-badge-info">
        <Loader2 className="h-2.5 w-2.5 animate-spin [animation-duration:1.5s]" />
        Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="badge status-badge-danger">
        <XCircle className="h-2.5 w-2.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="badge status-badge-warning">
      <RefreshCw className="h-2.5 w-2.5" />
      Needs reindex
    </span>
  );
}
