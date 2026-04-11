"use client";

import { useState } from "react";

import { streamChat } from "@/lib/api";
import type { SourceCitation } from "@/lib/types";

type ChatPreviewProps = {
  disabled?: boolean;
  onSuccess: () => void;
};

const DEFAULT_QUERY = "What is this document about?";

export function ChatPreview({ disabled, onSuccess }: ChatPreviewProps) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceCitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery() {
    setLoading(true);
    setAnswer("");
    setSources([]);
    setError(null);

    try {
      await streamChat(
        [{ role: "user", content: query }],
        {},
        {
          onToken: (token) => {
            setAnswer((current) => `${current}${token}`);
          },
          onSources: (items) => {
            setSources(items);
          },
          onError: (message) => {
            setError(message);
          },
        },
      );

      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-line bg-white px-4 py-4">
        <p className="text-sm font-medium">First query</p>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          className="mt-3 w-full resize-none border border-line px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void runQuery()}
          disabled={disabled || loading || query.trim().length === 0}
          className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Running..." : "Run query"}
        </button>
      </div>
      {error ? <div className="border border-warning px-3 py-2 text-sm text-ink">{error}</div> : null}
      {answer ? (
        <div className="space-y-3 border border-line bg-white px-4 py-4">
          <div>
            <p className="text-sm font-medium">Response</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{answer}</p>
          </div>
          {sources.length > 0 ? (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
              {sources.map((source, index) => (
                <div key={source.id} className="border border-line bg-panel px-3 py-2">
                  <p className="text-sm font-medium">
                    [{index + 1}] {source.filename}
                  </p>
                  <p className="mt-1 text-sm text-muted">{source.snippet}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
