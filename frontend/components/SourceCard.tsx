import { BookOpen, FileText } from "lucide-react";
import Link from "next/link";

import type { SourceCitation } from "@/lib/types";

type SourceCardProps = {
  source: SourceCitation;
};

export function SourceCard({ source }: SourceCardProps) {
  return (
    <Link
      href={`/documents/${source.document_id}`}
      title={`${source.filename}${source.page != null ? ` page ${source.page}` : ""}`}
      className="group flex max-w-[260px] items-center gap-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2.5 text-[12px] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-white">
        <FileText className="h-3.5 w-3.5" />
      </div>

      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-[var(--text-primary)]">
          {source.filename}
        </span>
        {source.page != null ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <BookOpen className="h-[10px] w-[10px] opacity-70" />
            Page {source.page}
          </span>
        ) : (
          <span className="mt-0.5 text-[10px] font-medium tracking-wider text-[var(--text-muted)]">
            View source →
          </span>
        )}
      </div>
    </Link>
  );
}
