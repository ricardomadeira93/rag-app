"use client";

import { motion } from "framer-motion";
import { RefreshCw, Search, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DocumentItem } from "@/components/DocumentItem";
import { StatusBanner } from "@/components/status-banner";
import {
  matchesSearch,
  normalizeDocumentType,
  type DocumentTypeFilter,
  type SortOption,
  type StatusFilter,
} from "@/lib/documents";
import { deleteDocument, fetchDocuments, fetchSettings, reindexDocuments, fetchAllTags, updateDocumentTags } from "@/lib/api";
import type { DocumentRecord, Settings } from "@/lib/types";

const pageTransition = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
} as const;

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [message, setMessage] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const tag = searchParams.get("tag");
    if (tag) {
      setSearchTerm(tag);
    }
  }, [searchParams]);

  useEffect(() => {
    const hasActiveProcessing = documents.some(
      (document) => document.status === "processing" || document.status === "needs_reprocessing",
    );

    if (!hasActiveProcessing) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchDocuments()
        .then((nextDocuments) => {
          setDocuments(nextDocuments);
        })
        .catch(() => null);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [documents]);

  async function load() {
    try {
      const [nextDocuments, nextSettings, tags] = await Promise.all([
        fetchDocuments(),
        fetchSettings(),
        fetchAllTags().catch(() => [])
      ]);
      setDocuments(nextDocuments);
      setSettings(nextSettings);
      setAllTags(tags);
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setDeletingId(documentId);
    try {
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      await deleteDocument(documentId);
      setMessage("Document deleted.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Delete failed");
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReindex() {
    setReindexing(true);
    try {
      await reindexDocuments();
      await load();
      setMessage("Re-index complete.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Re-index failed");
    } finally {
      setReindexing(false);
    }
  }

  async function handleUpdateTags(documentId: string, newTags: string[]) {
    try {
      // Optimistic update
      setDocuments(current =>
        current.map(doc => doc.id === documentId ? { ...doc, tags: newTags } : doc)
      );
      
      // Merge unique new tags into allTags
      setAllTags(current => Array.from(new Set([...current, ...newTags])).sort());
      
      await updateDocumentTags(documentId, newTags);
    } catch {
      // Ignore
    }
  }

  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((document) => {
      const matchesType = typeFilter === "all" || normalizeDocumentType(document.file_type) === typeFilter;
      const matchesStatus = statusFilter === "all" || document.status === statusFilter;
      return matchesType && matchesStatus && matchesSearch(document, searchTerm);
    });

    filtered.sort((left, right) => {
      if (sortBy === "name") {
        return left.filename.localeCompare(right.filename);
      }
      if (sortBy === "oldest") {
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    return filtered;
  }, [documents, searchTerm, sortBy, statusFilter, typeFilter]);

  return (
    <motion.div initial="hidden" animate="visible" variants={pageTransition} className="mx-auto max-w-6xl space-y-5">
      <motion.div variants={fadeUp} className="flex items-center justify-between gap-3">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Knowledge base</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleReindex()}
            disabled={reindexing || loading || documents.length === 0}
            className="button-secondary"
            title="Re-ingest documents"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? "animate-spin" : ""}`} />
            {reindexing ? "Re-indexing" : "Re-index"}
          </button>
          <button type="button" onClick={() => router.push("/documents/upload")} className="button-primary">
            <Upload className="h-3.5 w-3.5" />
            Upload files
          </button>
        </div>
      </motion.div>

      {settings?.reindex_required ? (
        <motion.div variants={fadeUp}>
          <StatusBanner
            tone="warning"
            title="Re-index required"
            body="Your embedding setup changed. Run a re-index before uploading or chatting."
          />
        </motion.div>
      ) : null}

      {message ? (
        <motion.div variants={fadeUp}>
          <StatusBanner tone={message.toLowerCase().includes("failed") ? "warning" : "neutral"} title="Documents" body={message} />
        </motion.div>
      ) : null}

      <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search files..."
            className="h-full flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as DocumentTypeFilter)} className="select w-[110px]">
            <option value="all">All types</option>
            <option value="pdf">PDF</option>
            <option value="audio">Audio</option>
            <option value="image">Image</option>
            <option value="markdown">Text</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="select w-[130px]">
            <option value="all">All statuses</option>
            <option value="indexed">Indexed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="needs_reprocessing">Needs reindex</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="select w-[100px]">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
          <span className="hidden text-[11px] text-[var(--text-muted)] sm:block">
            {filteredDocuments.length} file{filteredDocuments.length === 1 ? "" : "s"}
          </span>
        </div>
      </motion.div>

      <motion.section variants={fadeUp} className="panel overflow-hidden">
        <div className="hidden h-10 grid-cols-[20px,minmax(0,1fr),72px,120px,64px,82px,28px] items-center gap-3 border-b border-[var(--border-soft)] px-2 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)] md:grid">
          <span />
          <span>Name</span>
          <span>Type</span>
          <span>Status</span>
          <span className="text-right">Size</span>
          <span className="text-right">Date</span>
          <span />
        </div>

        <div className="space-y-1 px-1 py-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid h-9 grid-cols-[20px,minmax(0,1fr),72px,120px,64px,82px,28px] items-center gap-3 px-2">
                <div className="h-3.5 w-3.5 animate-pulse rounded bg-[var(--bg-subtle)]" />
                <div className="h-3 w-48 animate-pulse rounded bg-[var(--bg-subtle)]" />
                <div className="h-5 w-14 animate-pulse rounded bg-[var(--bg-subtle)]" />
                <div className="h-5 w-20 animate-pulse rounded bg-[var(--bg-subtle)]" />
                <div className="ml-auto h-3 w-10 animate-pulse rounded bg-[var(--bg-subtle)]" />
                <div className="ml-auto h-3 w-12 animate-pulse rounded bg-[var(--bg-subtle)]" />
              </div>
            ))
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Upload className="h-10 w-10 text-[var(--text-muted)]" />
              <p className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
                {documents.length === 0 ? "No documents yet" : "No files match your filters"}
              </p>
              <p className="mt-2 max-w-sm text-[13px] leading-6 text-[var(--text-muted)]">
                {documents.length === 0
                  ? "Upload PDFs, audio, images, or markdown and this workspace becomes searchable."
                  : "Adjust the search, type, or status filters to broaden the results."}
              </p>
              {documents.length === 0 ? (
                <button type="button" onClick={() => router.push("/documents/upload")} className="button-primary mt-5">
                  <Upload className="h-3.5 w-3.5" />
                  Upload files
                </button>
              ) : null}
            </div>
          ) : (
            filteredDocuments.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                allTags={allTags}
                deleting={deletingId === document.id}
                expanded={expandedId === document.id}
                onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                onDelete={(id) => void handleDelete(id)}
                onUpdateTags={handleUpdateTags}
              />
            ))
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
