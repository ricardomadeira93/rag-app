"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { 
  ArrowRight, 
  Check, 
  ChevronLeft, 
  Cpu, 
  Globe, 
  Layout, 
  MessageSquare, 
  Rocket, 
  Shield, 
  User 
} from "lucide-react";

import { fetchSettings, saveSettings } from "@/lib/api";
import type { ToneLiteral, ResponseLengthLiteral } from "@/lib/types";

const STAGES = [
  { id: 0, title: "Identity", icon: Layout },
  { id: 1, title: "Tone", icon: MessageSquare },
  { id: 2, title: "Intelligence", icon: Cpu },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [language, setLanguage] = useState("English");
  const [tone, setTone] = useState<ToneLiteral>("balanced");
  const [responseLength, setResponseLength] = useState<ResponseLengthLiteral>("detailed");

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      await saveSettings({
        workspace_name: workspaceName,
        workspace_description: workspaceDescription,
        user_name: userName,
        user_role: userRole,
        language,
        tone,
        response_length: responseLength,
        onboarding_complete: true,
      });
      router.push("/dashboard");
    } catch (err) {
      setError("Failed to save settings. Please try again.");
      setLoading(false);
    }
  }

  const isStepValid = () => {
    if (step === 0) return workspaceName.trim().length > 0 && userName.trim().length > 0;
    return true;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)] font-sans text-[var(--text-secondary)]">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-sm">
              S
            </div>
            <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Stark</span>
          </div>
          
          <div className="flex items-center gap-3">
            {STAGES.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div 
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    step >= i ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {step > i ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`mx-2 h-px w-6 ${step > i ? "bg-[var(--accent)]" : "bg-[var(--border-soft)]"}`} />
                )}
              </div>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mx-auto max-w-2xl"
            >
              {step === 0 && (
                <div className="space-y-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Welcome to Stark</h1>
                    <p className="mt-2 text-[var(--text-muted)]">Let&apos;s set up your environment to help the AI understand your context.</p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Workspace Name</label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="e.g. Acme Corp Docs"
                        className="input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Describe this space</label>
                      <input
                        type="text"
                        value={workspaceDescription}
                        onChange={(e) => setWorkspaceDescription(e.target.value)}
                        placeholder="e.g. Legal contracts and research"
                        className="input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Your Name</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="How should I call you?"
                        className="input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">Your Role</label>
                      <input
                        type="text"
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        placeholder="e.g. Lead Researcher"
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-10">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Tone & Style</h1>
                    <p className="mt-2 text-[var(--text-muted)]">How should the assistant interact with you?</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-[var(--text-primary)] uppercase tracking-wider">Response Tone</label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {(["professional", "balanced", "casual"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTone(t)}
                            className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                              tone === t 
                                ? "border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]" 
                                : "border-[var(--border-soft)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                            }`}
                          >
                            <span className={`text-sm font-bold capitalize ${tone === t ? "text-[var(--accent-text)]" : "text-[var(--text-primary)]"}`}>
                              {t}
                            </span>
                            <span className={`text-[11px] leading-relaxed ${tone === t ? "text-[var(--accent-text)] opacity-70" : "text-[var(--text-muted)]"}`}>
                              {t === "professional" && "Formal, precise, and direct."}
                              {t === "balanced" && "Conversational yet structured."}
                              {t === "casual" && "Friendly, approachable, and simple."}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-[var(--text-primary)] uppercase tracking-wider">Detail Level</label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(["concise", "detailed"] as const).map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setResponseLength(l)}
                            className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                              responseLength === l 
                                ? "border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]" 
                                : "border-[var(--border-soft)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]"
                            }`}
                          >
                            <span className={`text-sm font-bold capitalize ${responseLength === l ? "text-[var(--accent-text)]" : "text-[var(--text-primary)]"}`}>
                              {l}
                            </span>
                            <span className={`text-[11px] leading-relaxed ${responseLength === l ? "text-[var(--accent-text)] opacity-70" : "text-[var(--text-muted)]"}`}>
                              {l === "concise" ? "Short, high-level summaries." : "In-depth explanations with full context."}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-light)] text-[var(--accent)]">
                      <Rocket className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Ready to launch</h1>
                    <p className="mt-2 text-[var(--text-muted)]">Your private intelligence engine is configured and ready.</p>
                  </div>

                  <div className="panel overflow-hidden">
                    <div className="border-b border-[var(--border-soft)] bg-[var(--bg-subtle)] px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Configuration Summary</span>
                    </div>
                    <div className="grid gap-px bg-[var(--border-soft)] sm:grid-cols-2">
                      <div className="bg-[var(--bg-surface)] p-6">
                        <p className="text-xs font-medium text-[var(--text-muted)]">Workspace</p>
                        <p className="mt-1 font-semibold text-[var(--text-primary)]">{workspaceName}</p>
                      </div>
                      <div className="bg-[var(--bg-surface)] p-6">
                        <p className="text-xs font-medium text-[var(--text-muted)]">Intelligence Mode</p>
                        <p className="mt-1 font-semibold text-[var(--text-primary)]">Hybrid Cloud/Local</p>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-surface)] p-6 border-t border-[var(--border-soft)]">
                      <div className="flex items-start gap-3">
                        <Shield className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">Enterprise-grade security</p>
                          <p className="text-xs text-[var(--text-muted)]">All data is encrypted in transit and at rest. Your private documents are never used for training models.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-12 flex items-center justify-between pt-8 border-t border-[var(--border-soft)]">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0 || loading}
            className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-4">
            {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
            <button
              type="button"
              onClick={step === STAGES.length - 1 ? handleComplete : () => setStep((s) => s + 1)}
              disabled={!isStepValid() || loading}
              className="button-primary min-w-[120px] px-6 h-10 shadow-lg shadow-[var(--accent-custom-soft)]"
            >
              {loading ? (
                "Saving..."
              ) : step === STAGES.length - 1 ? (
                "Go to dashboard"
              ) : (
                <span className="flex items-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
