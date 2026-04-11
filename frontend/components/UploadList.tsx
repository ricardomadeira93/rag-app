"use client";

import { motion } from "framer-motion";

import { UploadItem } from "@/components/UploadItem";
import type { UploadQueueItem } from "@/lib/documents";

type UploadListProps = {
  items: UploadQueueItem[];
  totalProgress: number;
  isUploading: boolean;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
};

export function UploadList({ items, totalProgress, isUploading, onCancel, onClearCompleted }: UploadListProps) {
  const completedCount = items.filter((item) => item.status === "completed").length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label">Upload queue</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            {items.length === 0
              ? "Files you add will appear here."
              : isUploading
                ? `Total progress ${totalProgress}%`
                : `${completedCount} completed`}
          </p>
        </div>
        {completedCount > 0 ? (
          <button type="button" onClick={onClearCompleted} className="button-ghost">
            Clear completed
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-[12px] text-[var(--text-muted)]">No files in the queue.</div>
      ) : (
        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
          className="space-y-2"
        >
          {items.map((item) => (
            <UploadItem key={item.id} item={item} onCancel={onCancel} />
          ))}
        </motion.ul>
      )}
    </section>
  );
}
