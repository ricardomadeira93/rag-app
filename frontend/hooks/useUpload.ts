"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { detectDocumentType, formatFileSize, type UploadQueueItem } from "@/lib/documents";
import { fetchDocuments } from "@/lib/api";
import type { DocumentRecord } from "@/lib/types";

type UseUploadOptions = {
  disabled?: boolean;
  uploadFiles: (files: File[]) => Promise<DocumentRecord[]>;
  onUploadAccepted?: (documents: DocumentRecord[]) => Promise<void> | void;
  onUploadComplete?: (documents: DocumentRecord[]) => Promise<void> | void;
  onUploadError?: (message: string) => void;
};

type UseUploadResult = {
  items: UploadQueueItem[];
  isUploading: boolean;
  totalProgress: number;
  hasActiveUploads: boolean;
  selectFiles: (files: File[]) => void;
  startUpload: () => Promise<void>;
  cancelItem: (id: string) => void;
  clearCompleted: () => void;
};

export function useUpload({
  disabled = false,
  uploadFiles,
  onUploadAccepted,
  onUploadComplete,
  onUploadError,
}: UseUploadOptions): UseUploadResult {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const progressTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
      }
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
      }
    };
  }, []);

  const totalProgress = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    const total = items.reduce((sum, item) => sum + item.progress, 0);
    return Math.round(total / items.length);
  }, [items]);

  const hasActiveUploads = useMemo(
    () => items.some((item) => item.status === "uploading" || item.status === "processing"),
    [items],
  );

  function selectFiles(files: File[]) {
    if (disabled || files.length === 0) {
      return;
    }

    const nextItems = files.map<UploadQueueItem>((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      filename: file.name,
      fileType: detectDocumentType(file),
      mimeType: file.type,
      size: file.size,
      sizeLabel: formatFileSize(file.size),
      status: "queued",
      progress: 0,
    }));

    setItems((current) => [...current, ...nextItems]);
  }

  function cancelItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function clearCompleted() {
    setItems((current) => current.filter((item) => item.status !== "completed"));
  }

  async function startUpload() {
    if (disabled || isUploading) {
      return;
    }

    const pendingItems = items.filter((item) => item.status === "queued" || item.status === "failed");
    if (pendingItems.length === 0) {
      return;
    }

    setIsUploading(true);
    setItems((current) =>
      current.map((item) =>
        pendingItems.some((candidate) => candidate.id === item.id)
          ? { ...item, status: "uploading", progress: Math.max(item.progress, 8), error: undefined }
          : item,
      ),
    );

    progressTimerRef.current = window.setInterval(() => {
      setItems((current) =>
        current.map((item) => {
          if (!pendingItems.some((candidate) => candidate.id === item.id)) {
            return item;
          }

          if (item.status === "completed" || item.status === "failed") {
            return item;
          }

          const threshold = item.status === "uploading" ? 68 : 94;
          const nextProgress = Math.min(threshold, item.progress + (item.status === "uploading" ? 12 : 4));
          const nextStatus = nextProgress >= 68 ? "processing" : item.status;
          return {
            ...item,
            status: nextStatus,
            progress: nextProgress,
          };
        }),
      );
    }, 260);

    try {
      const uploadedDocuments = await uploadFiles(pendingItems.map((item) => item.file));

      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      const documentIds = uploadedDocuments.map((document) => document.id);
      setItems((current) =>
        current.map((item) => {
          const pendingIndex = pendingItems.findIndex((candidate) => candidate.id === item.id);
          if (pendingIndex === -1) {
            return item;
          }

          const uploadedDocument = uploadedDocuments[pendingIndex];
          if (!uploadedDocument) {
            return item;
          }

          return {
            ...item,
            documentId: uploadedDocument.id,
            status: uploadedDocument.status === "indexed" ? "completed" : uploadedDocument.status === "failed" ? "failed" : "processing",
            progress: uploadedDocument.status === "indexed" ? 100 : 72,
            error: uploadedDocument.error_message ?? undefined,
          };
        }),
      );

      await onUploadAccepted?.(uploadedDocuments);

      const hasPendingProcessing = uploadedDocuments.some(
        (document) => document.status === "processing" || document.status === "needs_reprocessing",
      );

      if (!hasPendingProcessing) {
        await onUploadComplete?.(uploadedDocuments);
      } else {
        pollingTimerRef.current = window.setInterval(() => {
          void pollDocumentStatuses(documentIds);
        }, 1500);
      }
    } catch (reason) {
      if (progressTimerRef.current !== null) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      const message = reason instanceof Error ? reason.message : "Upload failed";
      setItems((current) =>
        current.map((item) =>
          pendingItems.some((candidate) => candidate.id === item.id)
            ? { ...item, status: "failed", progress: 100, error: message }
            : item,
        ),
      );
      onUploadError?.(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function pollDocumentStatuses(documentIds: string[]) {
    try {
      const documents = await fetchDocuments();
      const trackedDocuments = documents.filter((document) => documentIds.includes(document.id));

      setItems((current) =>
        current.map((item) => {
          if (!item.documentId) {
            return item;
          }
          const matchingDocument = trackedDocuments.find((document) => document.id === item.documentId);
          if (!matchingDocument) {
            return item;
          }

          return {
            ...item,
            status:
              matchingDocument.status === "indexed"
                ? "completed"
                : matchingDocument.status === "failed"
                  ? "failed"
                  : "processing",
            progress: matchingDocument.status === "indexed" ? 100 : matchingDocument.status === "failed" ? item.progress : 92,
            error: matchingDocument.error_message ?? undefined,
          };
        }),
      );

      const done = trackedDocuments.every(
        (document) => document.status === "indexed" || document.status === "failed",
      );

      if (done) {
        if (pollingTimerRef.current !== null) {
          window.clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        await onUploadComplete?.(trackedDocuments);
      }
    } catch {
      // Keep polling on transient errors. The documents page will also poll independently.
    }
  }

  return {
    items,
    isUploading,
    totalProgress,
    hasActiveUploads,
    selectFiles,
    startUpload,
    cancelItem,
    clearCompleted,
  };
}
