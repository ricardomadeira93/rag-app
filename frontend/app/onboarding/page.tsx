"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlignLeft, Briefcase, Coffee, MessageSquare, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchSettings, saveSettings } from "@/lib/api";
import type { Settings } from "@/lib/types";

const languageOptions = ["English", "Portuguese", "Spanish", "French", "Other"];
const stepTitles = ["Workspace", "AI behavior", "Standing context"];

type FormState = {
  workspace_name: string;
  workspace_description: string;
  user_role: string;
  language: string;
  tone: "professional" | "balanced" | "casual";
  response_length: "concise" | "detailed";
  standing_context: string;
};

const defaultFormState: FormState = {
  workspace_name: "Kompact Workspace",
  workspace_description: "",
  user_role: "",
  language: "English",
  tone: "balanced",
  response_length: "detailed",
  standing_context: "",
};

const toneOptions: Array<{
  value: FormState["tone"];
  title: string;
  description: string;
  icon: typeof Briefcase;
}> = [
  {
    value: "professional",
    title: "Professional",
    description: "Formal, precise, well-structured answers",
    icon: Briefcase,
  },
  {
    value: "balanced",
    title: "Balanced",
    description: "Clear and helpful, neither stiff nor casual",
    icon: MessageSquare,
  },
  {
    value: "casual",
    title: "Casual",
    description: "Conversational, direct, no jargon",
    icon: Coffee,
  },
];

const lengthOptions: Array<{
  value: FormState["response_length"];
  title: string;
  description: string;
  icon: typeof AlignLeft;
}> = [
  {
    value: "concise",
    title: "Concise",
    description: "Short answers, key points only",
    icon: Zap,
  },
  {
    value: "detailed",
    title: "Detailed",
    description: "Full explanations with context",
    icon: AlignLeft,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultFormState);

  useEffect(() => {
    void fetchSettings()
      .then((settings) => {
        const nextState: FormState = {
          workspace_name: settings.workspace_name || defaultFormState.workspace_name,
          workspace_description: settings.workspace_description || "",
          user_role: settings.user_role || "",
          language: settings.language || "English",
          tone: settings.tone || "balanced",
          response_length: settings.response_length || "detailed",
          standing_context: settings.standing_context || "",
        };
        setFormState(nextState);
      })
      .catch(() => undefined);
  }, []);

  const canContinue = useMemo(() => formState.workspace_name.trim().length > 0, [formState.workspace_name]);

  function goToStep(nextStep: number) {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  }

  async function saveAndExit(payload: Partial<Settings>) {
    setSaving(true);
    try {
      await saveSettings(payload);
      router.replace("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    await saveAndExit({
      onboarding_complete: true,
      workspace_name: formState.workspace_name.trim(),
      workspace_description: formState.workspace_description.trim(),
      user_role: formState.user_role.trim(),
      language: formState.language,
      tone: formState.tone,
      response_length: formState.response_length,
      standing_context: formState.standing_context.trim(),
    });
  }

  async function handleSkip() {
    await saveAndExit({
      onboarding_complete: true,
      ...defaultFormState,
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[480px]">
        <div className="relative rounded-lg border border-line bg-panel p-8 shadow-sm">
          <button
            type="button"
            onClick={() => void handleSkip()}
            className="absolute right-6 top-6 text-xs text-muted hover:text-ink"
          >
            Skip
          </button>

          <div className="mb-6 flex items-center gap-2">
            {stepTitles.map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index === step ? "bg-[--accent]" : "bg-[--border-strong]"}`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {step === 0 ? (
                <>
                  <div>
                    <h1 className="text-lg font-semibold text-ink">Set up your workspace</h1>
                    <p className="mt-2 text-sm text-muted">
                      This helps the AI understand who you are and what you&apos;re working on.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-ink">Workspace name</span>
                      <input
                        value={formState.workspace_name}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, workspace_name: event.target.value }))
                        }
                        placeholder="Acme Legal"
                        className="input"
                        required
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-ink">What is this workspace for?</span>
                      <textarea
                        rows={3}
                        value={formState.workspace_description}
                        onChange={(event) =>
                          setFormState((prev) => ({ ...prev, workspace_description: event.target.value }))
                        }
                        placeholder="e.g. Legal documents and case files for our law firm"
                        className="input min-h-[96px] resize-none"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-ink">Your role</span>
                      <input
                        value={formState.user_role}
                        onChange={(event) => setFormState((prev) => ({ ...prev, user_role: event.target.value }))}
                        placeholder="e.g. Lawyer, Developer, Researcher"
                        className="input"
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      disabled={!canContinue}
                      className="button-primary"
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div>
                    <h1 className="text-lg font-semibold text-ink">How should the AI respond?</h1>
                    <p className="mt-2 text-sm text-muted">You can always change this later in Settings.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-ink">Language</span>
                      <select
                        value={formState.language}
                        onChange={(event) => setFormState((prev) => ({ ...prev, language: event.target.value }))}
                        className="input"
                      >
                        {languageOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink">Tone</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {toneOptions.map((option) => {
                          const selected = formState.tone === option.value;
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setFormState((prev) => ({ ...prev, tone: option.value }))}
                              className={`rounded-lg border px-3 py-3 text-left transition ${
                                selected ? "accent-border accent-ring" : "border-line hover:border-zinc-300"
                              }`}
                            >
                              <Icon className="h-5 w-5 text-ink" />
                              <p className="mt-2 text-sm font-medium text-ink">{option.title}</p>
                              <p className="mt-1 text-xs text-muted">{option.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink">Response length</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {lengthOptions.map((option) => {
                          const selected = formState.response_length === option.value;
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setFormState((prev) => ({ ...prev, response_length: option.value }))}
                              className={`rounded-lg border px-3 py-3 text-left transition ${
                                selected ? "accent-border accent-ring" : "border-line hover:border-zinc-300"
                              }`}
                            >
                              <Icon className="h-5 w-5 text-ink" />
                              <p className="mt-2 text-sm font-medium text-ink">{option.title}</p>
                              <p className="mt-1 text-xs text-muted">{option.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => goToStep(0)} className="button-secondary">
                      Back
                    </button>
                    <button type="button" onClick={() => goToStep(2)} className="button-primary">
                      Next
                    </button>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div>
                    <h1 className="text-lg font-semibold text-ink">Anything the AI should always know?</h1>
                    <p className="mt-2 text-sm text-muted">
                      This gets added to every conversation automatically.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <textarea
                      rows={5}
                      value={formState.standing_context}
                      onChange={(event) => setFormState((prev) => ({ ...prev, standing_context: event.target.value }))}
                      placeholder="e.g. All documents are confidential. Always cite page numbers. My clients are non-technical. Prefer metric units."
                      className="input min-h-[140px] resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveAndExit({
                          onboarding_complete: true,
                          workspace_name: formState.workspace_name.trim(),
                          workspace_description: formState.workspace_description.trim(),
                          user_role: formState.user_role.trim(),
                          language: formState.language,
                          tone: formState.tone,
                          response_length: formState.response_length,
                          standing_context: "",
                        });
                      }}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Skip this step
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => goToStep(1)} className="button-secondary">
                      Back
                    </button>
                    <button type="button" onClick={() => void handleFinish()} disabled={saving} className="button-primary">
                      {saving ? "Saving..." : "Start using Kompact"}
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
