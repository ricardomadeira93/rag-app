"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, MessageSquare, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchConversations, fetchDocuments } from "@/lib/api";
import { formatFileSize } from "@/lib/documents";

type SearchResult = {
  type: "document" | "conversation";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

async function fetchSearchResults(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  
  // We perform client-side filtering by hitting the standard GET endpoints for now.
  // This is highly responsive for small-to-medium local knowledge bases.
  try {
    const [docs, convs] = await Promise.all([
      fetchDocuments().catch(() => []), 
      fetchConversations().catch(() => [])
    ]);

    const docResults: SearchResult[] = docs
      .filter((d) => d.filename.toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({
        type: "document",
        id: d.id,
        title: d.filename,
        subtitle: `${formatFileSize(d.file_size_bytes)} • ${d.status}`,
        href: `/documents/${d.id}`,
      }));

    const convResults: SearchResult[] = convs
      .filter((c) => (c.title || "Untitled").toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({
        type: "conversation",
        id: c.id,
        title: c.title || "Untitled Conversation",
        href: `/chat/${c.id}`,
      }));

    return [...docResults, ...convResults];
  } catch (error) {
    console.error("[WorkspaceSearch] Failed to fetch data for search", error);
    return [];
  }
}

export function WorkspaceSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchSearchResults(q);
      setResults(res);
      setOpen(true);
      setActiveIndex(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(value), 280);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      setResults([]);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      const result = results[activeIndex];
      if (result) {
        router.push(result.href as any);
        setOpen(false);
        setQuery("");
      }
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const grouped = {
    documents: results.filter((r) => r.type === "document"),
    conversations: results.filter((r) => r.type === "conversation"),
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 text-sm shadow-[var(--shadow-soft)] transition-colors focus-within:border-[var(--border-strong)]"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <input
          id="workspace-search-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setOpen(true)}
          placeholder="Search workspace..."
          className="flex-1 border-none bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          aria-label="Search workspace"
          aria-expanded={open}
          aria-controls="workspace-search-results"
          aria-autocomplete="list"
          role="combobox"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-soft)] border-t-[var(--accent)]" />}
      </div>

      {open && (
        <div
          id="workspace-search-results"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-[var(--text-muted)]">No results for &quot;{query}&quot;</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {grouped.documents.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">Documents</p>
                  {grouped.documents.map((result, i) => {
                    const flatIndex = i;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => { router.push(result.href as any); setOpen(false); setQuery(""); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${flatIndex === activeIndex ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-subtle)]"}`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">{result.title}</p>
                          {result.subtitle && <p className="truncate text-xs text-[var(--text-muted)]">{result.subtitle}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {grouped.conversations.length > 0 && (
                <div>
                  <p className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]">Conversations</p>
                  {grouped.conversations.map((result, i) => {
                    const flatIndex = grouped.documents.length + i;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => { router.push(result.href as any); setOpen(false); setQuery(""); }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${flatIndex === activeIndex ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-subtle)]"}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <p className="truncate font-medium text-[var(--text-primary)]">{result.title}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
