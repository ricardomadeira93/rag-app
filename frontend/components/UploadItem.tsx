"use client";

import { motion } from "framer-motion";
import { CheckCircle, Loader2, X } from "lucide-react";

import { FileIcon } from "@/components/FileIcon";
import { uploadStatusLabel, type UploadQueueItem } from "@/lib/documents";

type UploadItemProps = {
  item: UploadQueueItem;
  onCancel: (id: string) => void;
};

export function UploadItem({ item, onCancel }: UploadItemProps) {
  const isCompleted = item.status === "completed";
  const isProcessing = item.status === "processing";

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: 4 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
      }}
      className="flex h-9 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--bg-subtle)]"
    >
      <FileIcon type={item.fileType} className="h-[14px] w-[14px]" />
      <span className="min-w-0 w-[220px] truncate text-[13px] text-[var(--text-primary)]" title={item.filename}>
        {item.filename}
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
        <motion.div
          className="h-full rounded-full bg-[var(--accent)]"
          animate={{ width: `${item.progress}%` }}
          transition={{ type: "spring", stiffness: 250, damping: 25 }}
        />
      </div>
      <span className="w-10 text-right text-[11px] text-[var(--text-muted)]">{item.progress}%</span>
      <span className="flex w-[92px] items-center gap-1 text-[11px] text-[var(--text-muted)]">
        {isCompleted ? (
          <CheckCircle className="h-3.5 w-3.5 text-[var(--success)]" />
        ) : (
          <Loader2 className={`h-3.5 w-3.5 ${isProcessing || item.status === "uploading" ? "animate-spin [animation-duration:1.5s]" : ""} text-[var(--accent)]`} />
        )}
        <span>{uploadStatusLabel(item.status)}</span>
      </span>
      <button
        type="button"
        onClick={() => onCancel(item.id)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
        title={`Cancel ${item.filename}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}
