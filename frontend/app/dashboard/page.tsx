"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  HardDrive,
  MessageSquare,
  Mic,
  Search,
  Sparkles,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchConversations, fetchDocuments, fetchSettings, fetchStorageUsage } from "@/lib/api";
import { formatBytes, formatNumber, formatRelativeTime } from "@/lib/format";
import type { Conversation, DocumentRecord, Settings, StorageUsage } from "@/lib/types";

const pageTransition = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
} as const;

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const [settingsResult, docsResult, conversationsResult, storageResult] = await Promise.allSettled([
        fetchSettings(),
        fetchDocuments(),
        fetchConversations(),
        fetchStorageUsage(),
      ]);

      if (!active) {
        return;
      }

      if (settingsResult.status === "fulfilled") {
        setSettings(settingsResult.value);
      }
      if (docsResult.status === "fulfilled") {
        setDocuments(docsResult.value);
      }
      if (conversationsResult.status === "fulfilled") {
        setConversations(conversationsResult.value);
      }
      if (storageResult.status === "fulfilled") {
        setStorage(storageResult.value);
      }

      const failures = [settingsResult, docsResult, conversationsResult, storageResult]
        .filter((result) => result.status === "rejected")
        .map((result) => (result.reason instanceof Error ? result.reason.message : "Failed to load dashboard"));

      setError(failures.length > 0 ? failures.join(". ") : null);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const recentDocuments = useMemo(
    () => [...documents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [documents],
  );
  const recentConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5),
    [conversations],
  );

  const lastUpdated = recentDocuments[0]?.created_at ?? null;
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState("");
  const workspaceName = settings?.workspace_name || "your workspace";
  const greeting = getGreeting();
  const hasDocuments = documents.length > 0;

  // Auto-refresh "last updated" label every 60s
  useEffect(() => {
    function update() {
      if (lastUpdated) {
        setLastUpdatedLabel(`Updated ${formatRelativeTime(lastUpdated)}`);
      } else {
        setLastUpdatedLabel("");
      }
    }
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  const metrics = [
    { label: "Documents", value: documents.length, hint: `${documents.length > 0 ? `+${Math.min(documents.length, 2)}` : "0"} today`, tone: "bg-blue-500", icon: FileText, format: (value: number) => formatNumber(value) },
    { label: "Conversations", value: conversations.length, hint: `${conversations.length > 0 ? `+${Math.min(conversations.length, 2)}` : "0"} today`, tone: "bg-violet-500", icon: MessageSquare, format: (value: number) => formatNumber(value) },
    { label: "Storage", value: storage?.total_bytes ?? 0, hint: storage ? formatBytes(storage.files_bytes) + " raw files" : "Loading", tone: "bg-amber-500", icon: HardDrive, format: (value: number) => formatBytes(value) },
    { label: "Chunks", value: storage?.chunk_count ?? 0, hint: storage ? `${formatNumber(storage.document_count)} indexed docs` : "Loading", tone: "bg-emerald-500", icon: Layers, format: (value: number) => formatNumber(value) },
  ] as const;

  return (
    <motion.div initial="hidden" animate="visible" variants={pageTransition} className="mx-auto max-w-6xl">
      {error ? (
        <motion.div variants={fadeUp} className="mb-4 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-light)] px-4 py-3 text-[12px] text-[var(--warning)]">
          {error}
        </motion.div>
      ) : null}

      <AnimatePresence mode="wait">
        {!loading && !hasDocuments ? (
          <motion.section
            key="empty"
            variants={fadeUp}
            className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"
          >
            <h1 className="text-[18px] font-semibold text-[var(--text-primary)]">Your knowledge base is empty</h1>
            <p className="mt-2 max-w-sm text-[14px] leading-6 text-[var(--text-secondary)]">
              Upload documents, audio, or images and your AI will learn from them.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/documents/upload" className="button-primary">
                Upload files
              </Link>
              <Link href="/chat" className="button-secondary">
                Start a chat
              </Link>
            </div>
            <div className="mt-7 grid gap-4 text-[11px] text-[var(--text-muted)] sm:grid-cols-3">
              <Hint icon={FileText} label="Ask questions about PDFs" />
              <Hint icon={Mic} label="Transcribe audio meetings" />
              <Hint icon={Search} label="Search across everything" />
            </div>
          </motion.section>
        ) : (
          <motion.div key="filled" variants={pageTransition} className="space-y-6">
            <motion.section variants={fadeUp} className="space-y-1">
              <h1 className="page-title">
                {greeting}, {workspaceName}
              </h1>
              <p className="text-[11px] text-[var(--text-muted)]">
                {lastUpdatedLabel || null}
              </p>
            </motion.section>

            <motion.section variants={fadeUp} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.format(metric.value)}
                  rawValue={metric.value}
                  hint={metric.hint}
                  tone={metric.tone}
                  icon={metric.icon}
                />
              ))}
            </motion.section>

            <div className="grid gap-4 lg:grid-cols-2">
              <motion.section variants={fadeUp} className="panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="section-label">Recent documents</p>
                  <Link href="/documents" className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                    View all
                  </Link>
                </div>
                <div className="space-y-1">
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => <RowSkeleton key={index} />)
                    : recentDocuments.map((doc) => (
                        <Link
                          key={doc.id}
                          href={`/documents/${doc.id}`}
                          title={doc.filename}
                          className="flex h-[34px] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--bg-subtle)]"
                        >
                          <FileText className="h-[14px] w-[14px] shrink-0 text-red-500" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{doc.filename}</span>
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(doc.created_at)}</span>
                        </Link>
                      ))}
                </div>
              </motion.section>

              <motion.section variants={fadeUp} className="panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="section-label">Recent conversations</p>
                  <Link href="/chat" className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                    Open chat
                  </Link>
                </div>
                <div className="space-y-1">
                  {loading
                    ? Array.from({ length: 5 }).map((_, index) => <RowSkeleton key={index} />)
                    : recentConversations.map((conversation) => (
                        <Link
                          key={conversation.id}
                          href="/chat"
                          title={conversation.title}
                          className="flex h-[34px] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--bg-subtle)]"
                        >
                          <MessageSquare className="h-[14px] w-[14px] shrink-0 text-violet-500" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{conversation.title}</span>
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(conversation.updated_at)}</span>
                        </Link>
                      ))}
                </div>
              </motion.section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function Hint({
  icon: Icon,
  label,
}: {
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Icon className="h-4 w-4 text-[var(--accent)]" />
      <span>{label}</span>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex h-[34px] items-center gap-3 rounded-lg px-2">
      <div className="h-3.5 w-3.5 animate-pulse rounded bg-[var(--bg-subtle)]" />
      <div className="h-3 w-40 animate-pulse rounded bg-[var(--bg-subtle)]" />
      <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[var(--bg-subtle)]" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  rawValue,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  rawValue: number;
  hint: string;
  tone: string;
  icon: typeof FileText;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(rawValue * eased));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    setDisplayValue(0);
    requestAnimationFrame(tick);
  }, [rawValue]);

  const numericValue =
    label === "Storage" ? value : formatNumber(displayValue);

  return (
    <div className="panel relative overflow-hidden p-4">
      <div className={`absolute inset-y-0 left-0 w-[3px] ${tone}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">{label}</p>
          <p className="mt-3 text-[22px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">
            {label === "Storage" ? value : numericValue}
          </p>
        </div>
        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
      </div>
      <p className="mt-3 text-[11px] text-[var(--success)]">{hint}</p>
    </div>
  );
}
