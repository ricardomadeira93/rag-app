"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchOllamaStatus } from "@/lib/api";
import type { OllamaStatus as OllamaStatusValue } from "@/lib/types";

type OllamaStatusProps = {
  enabled: boolean;
  onChange?: (status: OllamaStatusValue) => void;
  buttonLabel?: string;
};

const DEFAULT_STATUS: OllamaStatusValue = {
  status: "not_running",
  models: [],
};

export function OllamaStatus({ enabled, onChange, buttonLabel = "Check again" }: OllamaStatusProps) {
  const [status, setStatus] = useState<OllamaStatusValue>(DEFAULT_STATUS);
  const [checking, setChecking] = useState(false);

  const checkAgain = useCallback(async () => {
    setChecking(true);
    try {
      const nextStatus = await fetchOllamaStatus();
      setStatus(nextStatus);
      onChange?.(nextStatus);
    } catch {
      const fallback = DEFAULT_STATUS;
      setStatus(fallback);
      onChange?.(fallback);
    } finally {
      setChecking(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void checkAgain();
  }, [checkAgain, enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-raised)] p-4">
      {status.status === "running" ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
            Ollama is running
          </p>
          <div className="space-y-2">
            <p className="text-[12px] text-[var(--text-muted)]">Available models</p>
            {status.models && status.models.length > 0 ? (
              <ul className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                {status.models.map((model) => (
                  <li key={model} className="badge">
                    {model}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[var(--text-muted)]">No models found yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">Ollama not detected</p>
          <ol className="space-y-1 text-[12px] text-[var(--text-muted)]">
            <li>1. Install Ollama</li>
            <li>2. Open the Ollama app</li>
          </ol>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void checkAgain()}
          disabled={checking}
          className="button-secondary"
        >
          {checking ? "Checking..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}
