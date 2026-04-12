import { BookOpen, FileText, Mail, Hash, FileBox, Github } from "lucide-react";
import Link from "next/link";

import type { SourceCitation } from "@/lib/types";

type SourceCardProps = {
  source: SourceCitation;
};

const SOURCE_ICONS: Record<string, any> = {
  gmail: { icon: Mail, color: "#EA4335" },
  slack: { icon: Hash, color: "#4A154B" },
  notion: { icon: FileBox, color: "#000000" },
  github: { icon: Github, color: "#24292F" },
};

export function SourceCard({ source }: SourceCardProps) {
  const customSource = source.source_type ? SOURCE_ICONS[source.source_type] : null;
  const Icon = customSource ? customSource.icon : FileText;

  return (
    <Link
      href={`/documents/${source.document_id}`}
      title={`${source.filename}${source.page != null ? ` page ${source.page}` : ""}`}
      className="group flex flex-col w-full max-w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-3 text-[12px] shadow-sm transition-all hover:border-[var(--border-strong)] hover:shadow-md"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:!bg-[var(--accent)] group-hover:!text-white ${customSource ? 'bg-[var(--dynamic-bg)] text-[var(--dynamic-text)]' : 'bg-[var(--accent-light)] text-[var(--accent)]'}`}
            style={customSource ? { "--dynamic-bg": `${customSource.color}20`, "--dynamic-text": customSource.color } as React.CSSProperties : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
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
            ) : null}
          </div>
        </div>

        {source.similarity_percent ? (
          <div className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {source.similarity_percent}
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 pl-9 line-clamp-2 text-[11px] leading-relaxed italic text-[var(--text-secondary)]">
        &quot;{source.snippet.substring(0, 140)}{source.snippet.length > 140 ? '...' : ''}&quot;
      </div>
    </Link>
  );
}
