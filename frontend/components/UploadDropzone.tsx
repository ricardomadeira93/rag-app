"use client";

import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";
import { ChangeEvent, DragEvent, KeyboardEvent, useRef, useState } from "react";

import type { UploadQueueItem } from "@/lib/documents";

type UploadDropzoneProps = {
  disabled?: boolean;
  isUploading?: boolean;
  items: UploadQueueItem[];
  totalProgress?: number;
  onFilesSelected: (files: File[]) => void;
  onUpload: () => Promise<void>;
};

const ACCEPTED_TYPES = "application/pdf,.md,.markdown,image/*,audio/*";
const springTransition = { type: "spring", stiffness: 400, damping: 30 } as const;

export function UploadDropzone({
  disabled = false,
  isUploading = false,
  items,
  totalProgress = 0,
  onFilesSelected,
  onUpload,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }
    setDragging(false);
    onFilesSelected(Array.from(event.dataTransfer.files ?? []));
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  return (
    <section className="space-y-4">
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.id} className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
              <span className="max-w-[220px] truncate" title={item.filename}>
                {item.filename}
              </span>
              <span className="text-[var(--text-muted)]">{item.sizeLabel}</span>
              <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </div>
          ))}
        </div>
      ) : null}

      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        animate={{
          scale: dragging ? 1.01 : 1,
          borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
          backgroundColor: dragging ? "var(--accent-light)" : "transparent",
        }}
        transition={springTransition}
        className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-200"
      >
        <Upload className={`mb-3 h-8 w-8 ${dragging ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
          {isUploading ? `Uploading ${totalProgress}%` : "Drop files here"}
        </h2>
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">
          PDF, audio, images, markdown. Up to 100MB.
        </p>
        
        {!isUploading && items.length === 0 ? (
          <div className="mt-5">
            <button type="button" className="button-secondary pointer-events-none" disabled={disabled}>
              Browse files
            </button>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={handleSelect}
          disabled={disabled}
          className="hidden"
        />
      </motion.div>
    </section>
  );
}
