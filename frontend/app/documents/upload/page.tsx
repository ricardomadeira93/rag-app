"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusBanner } from "@/components/status-banner";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UploadList } from "@/components/UploadList";
import { useUpload } from "@/hooks/useUpload";
import { fetchSettings, uploadDocuments } from "@/lib/api";
import type { Settings } from "@/lib/types";

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
} as const;

export default function UploadPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchSettings().then(setSettings).catch(() => null);
  }, []);

  const {
    items: uploadQueue,
    isUploading,
    totalProgress,
    selectFiles,
    startUpload,
    cancelItem,
    clearCompleted,
  } = useUpload({
    disabled: Boolean(settings?.reindex_required),
    uploadFiles: uploadDocuments,
    onUploadAccepted: () => {
      setMessage("Files uploaded. Indexing updates live below.");
    },
    onUploadComplete: (documents) => {
      const failedCount = documents.filter((document) => document.status === "failed").length;
      setMessage(
        failedCount > 0
          ? `${failedCount} file${failedCount === 1 ? "" : "s"} failed during indexing.`
          : "Indexing finished.",
      );
    },
    onUploadError: (nextMessage) => {
      setMessage(nextMessage);
    },
  });

  return (
    <motion.div initial="hidden" animate="visible" className="mx-auto max-w-4xl space-y-6">
      <motion.button
        variants={fadeUp}
        type="button"
        onClick={() => router.push("/documents")}
        className="flex items-center gap-2 text-[13px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Documents
      </motion.button>

      <motion.div variants={fadeUp} className="space-y-1">
        <h1 className="text-[18px] font-semibold text-[var(--text-primary)]">Upload files</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Drop PDFs, audio, images, or markdown into your local knowledge base.
        </p>
      </motion.div>

      {settings?.reindex_required ? (
        <motion.div variants={fadeUp}>
          <StatusBanner
            tone="warning"
            title="Re-index required"
            body="Uploading is disabled until you re-index documents in Settings."
          />
        </motion.div>
      ) : null}

      {message ? (
        <motion.div variants={fadeUp}>
          <StatusBanner tone={message.toLowerCase().includes("failed") ? "warning" : "neutral"} title="Uploads" body={message} />
        </motion.div>
      ) : null}

      <motion.div variants={fadeUp}>
        <UploadDropzone
          isUploading={isUploading}
          items={uploadQueue}
          totalProgress={totalProgress}
          disabled={Boolean(settings?.reindex_required)}
          onFilesSelected={selectFiles}
          onUpload={startUpload}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <UploadList
          items={uploadQueue}
          totalProgress={totalProgress}
          isUploading={isUploading}
          onCancel={cancelItem}
          onClearCompleted={clearCompleted}
        />
      </motion.div>
    </motion.div>
  );
}
