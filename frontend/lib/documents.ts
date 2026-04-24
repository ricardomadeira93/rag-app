import type { DocumentRecord } from "@/lib/types";

export type DocumentStatus = "processing" | "indexed" | "failed" | "needs_reprocessing";
export type DocumentTypeFilter = "all" | "pdf" | "audio" | "image" | "markdown";
export type StatusFilter = "all" | DocumentStatus;
export type SortOption = "newest" | "oldest" | "name";
export type UploadItemStatus = "queued" | "uploading" | "processing" | "completed" | "failed";

export type UploadQueueItem = {
  id: string;
  documentId?: string;
  file: File;
  filename: string;
  fileType: Exclude<DocumentTypeFilter, "all">;
  mimeType: string;
  size: number;
  sizeLabel: string;
  status: UploadItemStatus;
  progress: number;
  error?: string;
};

export function normalizeDocumentType(value: string | null | undefined): Exclude<DocumentTypeFilter, "all"> {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "pdf") {
    return "pdf";
  }
  if (normalized === "audio") {
    return "audio";
  }
  if (normalized === "image") {
    return "image";
  }
  return "markdown";
}

export function fileTypeLabel(value: string | null | undefined): string {
  const normalized = normalizeDocumentType(value);
  if (normalized === "markdown") return "Markdown";
  if (normalized === "pdf") return "PDF";
  if (normalized === "audio") return "Audio";
  return "Image";
}

export function detectDocumentType(file: File): Exclude<DocumentTypeFilter, "all"> {
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  return "markdown";
}

export function fileTypeIcon(value: string | null | undefined): string {
  const normalized = normalizeDocumentType(value);
  if (normalized === "pdf") {
    return "PDF";
  }
  if (normalized === "audio") {
    return "AUDIO";
  }
  if (normalized === "image") {
    return "IMAGE";
  }
  return "TEXT";
}

export function fileTypeClasses(value: string | null | undefined): string {
  const normalized = normalizeDocumentType(value);
  if (normalized === "pdf") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (normalized === "audio") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "image") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function statusClasses(status: DocumentStatus): string {
  if (status === "indexed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  // needs_reprocessing
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function uploadStatusLabel(status: UploadItemStatus): string {
  if (status === "processing") {
    return "Processing...";
  }
  if (status === "completed") {
    return "Completed";
  }
  if (status === "queued") {
    return "Ready";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function matchesSearch(document: DocumentRecord, searchTerm: string): boolean {
  if (!searchTerm.trim()) {
    return true;
  }
  const query = searchTerm.trim().toLowerCase();
  return (
    document.filename.toLowerCase().includes(query) ||
    document.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}
