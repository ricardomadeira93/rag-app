type StepperProps = {
  currentStep: number;
  steps: string[];
};

export function Stepper({ currentStep, steps }: StepperProps) {
  return (
    <ol className="grid gap-2 md:grid-cols-3">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const state =
          stepNumber < currentStep ? "complete" : stepNumber === currentStep ? "current" : "upcoming";

        return (
          <li
            key={step}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              state === "current"
                ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                : state === "complete"
                  ? "border-line bg-white text-ink"
                  : "border-line bg-white text-muted"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide">Step {stepNumber}</p>
            <p className="mt-1 text-sm font-medium">{step}</p>
          </li>
        );
      })}
    </ol>
  );
}
