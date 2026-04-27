"use client";

import { useEffect, useState } from "react";

type Phase = "connecting" | "connected" | "hidden";

export function ConnectionStatus({ resolved }: { resolved: boolean }) {
  const [phase, setPhase] = useState<Phase>("connecting");
  const [slow, setSlow] = useState(false);

  // Show cold-start notice after 4s if still connecting
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!resolved || phase !== "connecting") return;
    setPhase("connected");
    const timer = setTimeout(() => setPhase("hidden"), 1600);
    return () => clearTimeout(timer);
  }, [resolved, phase]);

  if (phase === "hidden") return null;

  const isConnected = phase === "connected";

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] pointer-events-none"
      style={{
        opacity: isConnected ? 0 : 1,
        transform: isConnected ? "translateY(8px)" : "translateY(0)",
        transition: "opacity 500ms ease, transform 500ms ease",
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-xl"
        style={{
          background: "rgba(22, 22, 20, 0.88)",
          borderColor: "rgba(255, 255, 255, 0.06)",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.03)",
          minWidth: 240,
        }}
      >
        {isConnected ? (
          <>
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
              <svg
                className="h-2.5 w-2.5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-[13px] font-medium" style={{ color: "#ededea" }}>
              Connected
            </p>
          </>
        ) : (
          <>
            <div
              className="h-4 w-4 animate-spin rounded-full border-2 shrink-0"
              style={{
                borderColor: "rgba(124, 124, 240, 0.3)",
                borderTopColor: "#7c7cf0",
              }}
            />
            <div>
              <p
                className="text-[13px] font-semibold leading-tight"
                style={{ color: "#ededea" }}
              >
                Warming up the AI
              </p>
              <p
                className="mt-0.5 text-[11px] leading-snug"
                style={{ color: "#8b8882" }}
              >
                {slow
                  ? "Free-tier server cold starting — usually under 60s"
                  : "Your assistant will be ready in a moment"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
