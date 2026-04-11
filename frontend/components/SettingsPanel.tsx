import type { ReactNode } from "react";

type SettingsPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingsPanel({ title, description, children }: SettingsPanelProps) {
  return (
    <section className="panel p-5">
      <div className="mb-4">
        <h2 className="text-[13px] font-medium text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
