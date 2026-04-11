"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-[color:rgba(10,10,10,0.42)] backdrop-blur-[2px]"
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
          {description ? <p className="text-sm text-[var(--text-secondary)]">{description}</p> : null}
          {children ? <div className="pt-2 text-sm text-[var(--text-secondary)]">{children}</div> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="button-secondary" disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "inline-flex min-h-[32px] items-center justify-center rounded-lg bg-[var(--danger)] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[color:rgb(185,28,28)] disabled:cursor-not-allowed disabled:opacity-50"
                : "button-primary"
            }
            disabled={loading}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
