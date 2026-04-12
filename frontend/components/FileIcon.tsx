"use client";

import { File, FileAudio, FileCode, FileText, Image } from "lucide-react";

type FileIconProps = {
  type?: string | null;
  filename?: string | null;
  className?: string;
};

const EXTENSION_MAP: Record<string, { icon: typeof File; color: string }> = {
  ".md":   { icon: FileCode, color: "text-[#8b5cf6]" },   // purple
  ".pdf":  { icon: FileText, color: "text-[#ef4444]" },    // red
  ".mp3":  { icon: FileAudio, color: "text-[#3b82f6]" },   // blue
  ".wav":  { icon: FileAudio, color: "text-[#3b82f6]" },
  ".m4a":  { icon: FileAudio, color: "text-[#3b82f6]" },
  ".png":  { icon: Image, color: "text-[#f59e0b]" },       // amber
  ".jpg":  { icon: Image, color: "text-[#f59e0b]" },
  ".jpeg": { icon: Image, color: "text-[#f59e0b]" },
  ".txt":  { icon: FileText, color: "text-[#6b7280]" },    // gray
};

export function getExtension(filename: string | null | undefined): string {
  if (!filename) return "";
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function FileIcon({ type, filename, className = "" }: FileIconProps) {
  const ext = getExtension(filename);
  const match = EXTENSION_MAP[ext];

  if (match) {
    const Icon = match.icon;
    return <Icon className={`shrink-0 ${match.color} ${className}`} />;
  }

  // Fallback to type-based
  const normalized = (type ?? "").trim().toLowerCase();
  if (normalized === "audio") {
    return <FileAudio className={`shrink-0 text-[#3b82f6] ${className}`} />;
  }
  if (normalized === "image") {
    return <Image className={`shrink-0 text-[#f59e0b] ${className}`} />;
  }
  if (normalized === "pdf") {
    return <FileText className={`shrink-0 text-[#ef4444] ${className}`} />;
  }
  if (normalized === "markdown") {
    return <FileCode className={`shrink-0 text-[#8b5cf6] ${className}`} />;
  }

  return <File className={`shrink-0 text-[#6b7280] ${className}`} />;
}
