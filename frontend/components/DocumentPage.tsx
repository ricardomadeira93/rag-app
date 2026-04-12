"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Brain, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { DocumentContent } from "@/components/DocumentContent";
import { DocumentHeader } from "@/components/DocumentHeader";
import { Button } from "@/components/ui/button";
import { fetchDocumentDetail } from "@/lib/api";
import type { DocumentDetail } from "@/lib/types";

type DocumentPageProps = {
  documentId: string;
};

const springTransition = {
  type: "spring",
  stiffness: 250,
  damping: 25,
} as const;

export function DocumentPage({ documentId }: DocumentPageProps) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"ask" | "summarize">("ask");

  useEffect(() => {
    void (async () => {
      try {
        const nextDetail = await fetchDocumentDetail(documentId);
        setDetail(nextDetail);
        setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Failed to load document");
      } finally {
        setLoading(false);
      }
    })();
  }, [documentId]);

  function openAiPanel(mode: "ask" | "summarize") {
    setPanelMode(mode);
    setAiPanelOpen(true);
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-12 md:px-6 md:pt-20">
        <div className="mb-8">
          <Link href="/documents" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            Back to documents
          </Link>
        </div>

        {loading ? <DocumentSkeleton /> : null}
        {!loading && error ? <DocumentError message={error} /> : null}
        {!loading && detail ? (
          <>
            <DocumentHeader detail={detail} onAskAi={() => openAiPanel("ask")} onSummarize={() => openAiPanel("summarize")} />
            <DocumentContent detail={detail} />
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {aiPanelOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close AI panel"
              onClick={() => setAiPanelOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-20 bg-zinc-950/10 backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 36 }}
              transition={springTransition}
              className="fixed right-0 top-0 z-30 flex h-screen w-full max-w-md flex-col border-l border-zinc-200 bg-[rgba(250,250,250,0.98)] px-6 py-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{panelMode === "ask" ? "Ask AI about this document" : "Summarize document"}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    UI placeholder for the next step in the document workflow.
                  </p>
                </div>
                <Button variant="ghost" size="icon" type="button" onClick={() => setAiPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-10 rounded-3xl bg-zinc-100/70 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm">
                  {panelMode === "ask" ? <Brain className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <p className="mt-5 text-lg font-semibold text-zinc-950">
                  {panelMode === "ask" ? "Ask AI about this document" : "Generate a focused summary"}
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-600">
                  Keep the reader focused, then open AI assistance only when needed. This panel is ready for chat or summary actions once the backend workflow is connected.
                </p>
              </div>

              <div className="mt-6 flex-1 rounded-3xl border border-dashed border-zinc-200 px-5 py-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">Prompt</p>
                <div className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm leading-7 text-zinc-500 shadow-sm">
                  {panelMode === "ask"
                    ? "Ask a question grounded in this document’s extracted content."
                    : "Produce a concise summary of the current document and highlight the main topics."}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-10 h-14 w-14 rounded-[20px] bg-zinc-100" />
      <div className="h-12 w-2/3 rounded-2xl bg-zinc-100" />
      <div className="mt-4 h-5 w-1/2 rounded-xl bg-zinc-100" />
      <div className="mt-12 space-y-5">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-4 w-full rounded bg-zinc-100" />
            <div className="h-4 w-[96%] rounded bg-zinc-100" />
            <div className="h-4 w-[82%] rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentError({ message }: { message: string }) {
  return (
    <div className="rounded-3xl bg-zinc-100/80 px-6 py-8">
      <p className="text-lg font-semibold text-zinc-950">Unable to open this document</p>
      <p className="mt-3 text-base leading-8 text-zinc-600">{message}</p>
    </div>
  );
}
