"use client";

import { Database, FileStack, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchDiskUsage, fetchStorageUsage } from "@/lib/api";
import { formatBytes, formatNumber, formatRelativeTime } from "@/lib/format";
import type { DiskUsage, StorageUsage } from "@/lib/types";

export function StoragePanel() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [nextUsage, nextDisk] = await Promise.all([fetchStorageUsage(), fetchDiskUsage()]);
        setUsage(nextUsage);
        setDisk(nextDisk);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Failed to load storage");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) {
    return <p className="text-[12px] text-[var(--danger)]">{error}</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StorageMetric icon={HardDrive} label="Total used" value={loading ? "…" : formatBytes(usage?.total_bytes ?? 0)} />
        <StorageMetric icon={Database} label="Vector index" value={loading ? "…" : formatBytes(usage?.chroma_bytes ?? 0)} />
        <StorageMetric icon={FileStack} label="Raw files" value={loading ? "…" : formatBytes(usage?.files_bytes ?? 0)} />
      </div>

      {!loading && disk ? (
        <p className="text-[12px] text-[var(--text-muted)]">
          {formatBytes(disk.free_bytes)} free of {formatBytes(disk.total_bytes)}
        </p>
      ) : null}

      {!loading && usage?.documents.length ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_80px_100px] gap-3 border-b border-[var(--border-soft)] px-4 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            <span>Name</span>
            <span className="text-right">Chunks</span>
            <span className="text-right">Size</span>
            <span className="text-right">Indexed</span>
          </div>
          {usage.documents.map((document) => (
            <div
              key={document.id}
              className="grid grid-cols-[minmax(0,1fr)_80px_80px_100px] gap-3 px-4 py-2 text-[12px] text-[var(--text-secondary)]"
            >
              <span className="truncate text-[var(--text-primary)]" title={document.name}>
                {document.name}
              </span>
              <span className="text-right">{formatNumber(document.chunk_count)}</span>
              <span className="text-right">{formatBytes(document.file_size_bytes)}</span>
              <span className="text-right">{formatRelativeTime(document.indexed_at)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StorageMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-raised)] p-4">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
