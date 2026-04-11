import type { ReactNode } from "react";

type StatusBannerProps = {
  tone?: "warning" | "neutral";
  title: string;
  body: string;
  action?: ReactNode;
};

export function StatusBanner({ tone = "neutral", title, body, action }: StatusBannerProps) {
  const className =
    tone === "warning"
      ? "rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-light)] text-[var(--text-primary)]"
      : "rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] text-[var(--text-primary)]";

  return (
    <div className={`${className}`}>
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-[13px] font-medium">{title}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{body}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
