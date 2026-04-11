"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  function dismissToast(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast(toast) {
        const id = crypto.randomUUID();
        setItems((current) => [...current, { ...toast, id }]);
        window.setTimeout(() => {
          dismissToast(id);
        }, 3200);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = item.tone === "error" ? AlertCircle : CheckCircle2;
            const toneClass =
              item.tone === "error"
                ? "border-[color:rgba(220,38,38,0.22)] bg-[var(--danger-light)] text-[var(--danger)]"
                : "border-[color:rgba(22,163,74,0.22)] bg-[var(--success-light)] text-[var(--success)]";

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] ${toneClass}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-[color:rgba(255,255,255,0.55)] p-1">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.description ? (
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    title="Dismiss notification"
                    aria-label="Dismiss notification"
                    onClick={() => dismissToast(item.id)}
                    className="rounded-full p-1 text-current/70 transition-colors hover:bg-[color:rgba(255,255,255,0.45)] hover:text-current"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
