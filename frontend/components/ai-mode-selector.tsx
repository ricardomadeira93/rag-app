import type { AiMode } from "@/lib/onboarding";

type AiModeSelectorProps = {
  selectedMode: AiMode | null;
  onSelect: (mode: AiMode) => void;
};

const options: Array<{
  mode: AiMode;
  title: string;
  lines: string[];
}> = [
  {
    mode: "local",
    title: "Local (Private)",
    lines: ["Runs on your device", "Free", "Requires Ollama"],
  },
  {
    mode: "cloud",
    title: "Cloud (Faster)",
    lines: ["Uses external AI", "Requires API key"],
  },
];

export function AiModeSelector({ selectedMode, onSelect }: AiModeSelectorProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((option) => {
        const selected = selectedMode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            onClick={() => onSelect(option.mode)}
            className={`border px-4 py-4 text-left transition ${
              selected ? "border-ink bg-panel text-ink" : "border-line bg-white text-ink hover:bg-panel"
            }`}
          >
            <p className="text-sm font-medium">{option.title}</p>
            <div className="mt-3 space-y-1">
              {option.lines.map((line) => (
                <p key={line} className="text-sm text-muted">
                  {line}
                </p>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
