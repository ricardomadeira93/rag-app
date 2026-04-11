import type { ReactNode } from "react";

type OnboardingCardProps = {
  title: string;
  description: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
  children?: ReactNode;
};

export function OnboardingCard({
  title,
  description,
  selected = false,
  disabled = false,
  badge,
  onClick,
  children,
}: OnboardingCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`panel w-full text-left transition ${
        selected ? "accent-border accent-ring" : "hover:-translate-y-0.5 hover:border-zinc-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          {badge ? <span className="badge shrink-0">{badge}</span> : null}
        </div>
        {children}
      </div>
    </button>
  );
}
