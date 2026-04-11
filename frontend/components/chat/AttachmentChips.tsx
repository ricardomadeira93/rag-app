"use client";

import { X } from "lucide-react";

import { FileIcon } from "@/components/FileIcon";
import type { DocumentRecord } from "@/lib/types";

type AttachmentChipsProps = {
  documents: DocumentRecord[];
  onRemove: (id: string) => void;
};

export function AttachmentChips({ documents, onRemove }: AttachmentChipsProps) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
      {documents.map((document) => {
        return (
          <div
            key={document.id}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-subtle)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]"
          >
            <FileIcon type={document.file_type} className="h-3.5 w-3.5" />
            <span className="max-w-[180px] truncate">{document.filename}</span>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => onRemove(document.id)}
              title={`Remove ${document.filename}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
