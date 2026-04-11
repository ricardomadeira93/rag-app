import { BookOpen } from "lucide-react";

import type { SourceCitation } from "@/lib/types";

type SourceCardProps = {
  source: SourceCitation;
};

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div
      title={`${source.filename}${source.page != null ? ` page ${source.page}` : ""}`}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] text-[var(--accent-text)] transition-colors hover:bg-[var(--accent)] hover:text-white"
    >
      <BookOpen className="h-2.5 w-2.5" />
      <span className="max-w-[220px] truncate">
        {source.filename}
        {source.page != null ? ` p.${source.page}` : ""}
      </span>
    </div>
  );
}
