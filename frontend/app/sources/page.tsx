"use client";

import { Link2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { connectSource, fetchSources } from "@/lib/api";
import type { SourceRecord } from "@/lib/types";

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSources();
  }, []);

  async function loadSources() {
    try {
      setLoading(true);
      setError(null);
      setSources(await fetchSources());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(sourceId: string) {
    try {
      setConnectingId(sourceId);
      const result = await connectSource(sourceId);
      if (result.auth_url) {
        window.location.href = result.auth_url;
        return;
      }
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect source");
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Sources
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
            Connected data sources
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Manage external connectors and monitor which sources are available to the workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSources()}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-subtle)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((source) => (
            <article
              key={source.id}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-text)]">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-medium text-[var(--text-primary)]">{source.name}</h2>
                    <p className="mt-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      {source.status}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConnect(source.id)}
                  disabled={connectingId === source.id}
                  className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                >
                  {connectingId === source.id ? "Connecting..." : "Connect"}
                </button>
              </div>

              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
                {source.description || "No description available."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1">
                  Indexed: {source.items_indexed ?? 0}
                </span>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1">
                  Last sync: {source.last_synced ?? "Never"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
