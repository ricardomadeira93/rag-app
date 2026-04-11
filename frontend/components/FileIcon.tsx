"use client";

import { File, FileAudio, FileCode, FileText, Image } from "lucide-react";
import { normalizeDocumentType } from "@/lib/documents";

type FileIconProps = {
  type: string | null | undefined;
  className?: string;
};

const colorMap: Record<string, string> = {
  pdf: "text-red-500",
  audio: "text-violet-500",
  image: "text-blue-500",
  markdown: "text-emerald-500",
};

export function FileIcon({ type, className = "" }: FileIconProps) {
  const normalized = normalizeDocumentType(type);
  const Icon =
    normalized === "audio" ? FileAudio
    : normalized === "image" ? Image
    : normalized === "pdf" ? FileText
    : normalized === "markdown" ? FileCode
    : File;
  const color = colorMap[normalized] ?? "text-zinc-400";

  return <Icon className={`shrink-0 ${color} ${className}`} />;
}
