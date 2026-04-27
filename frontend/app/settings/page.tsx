"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { OllamaStatus } from "@/components/OllamaStatus";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBanner } from "@/components/status-banner";
import { StoragePanel } from "@/components/StoragePanel";
import { useToast } from "@/components/toast-provider";
import { deleteDocument, fetchDocuments, fetchSettings, reindexDocuments, saveSettings, fetchMemories, deleteMemory } from "@/lib/api";
import type { MemoryItem } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { applyUiTheme } from "@/lib/ui-theme";

const tabs = ["General", "Advanced", "Memory", "Data", "About"] as const;
type Tab = (typeof tabs)[number];

export default function SettingsPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"reset-knowledge" | "reset-onboarding" | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }

    applyUiTheme(settings);
  }, [settings]);

  async function load() {
    try {
      setMemoriesLoading(true);
      const [nextSettings, documents, fetchedMemories] = await Promise.all([
        fetchSettings(),
        fetchDocuments(),
        fetchMemories().catch(() => []) // gracefully handle if db hasn't init'd
      ]);
      setSettings(nextSettings);
      setDocumentCount(documents.length);
      setChunkCount(documents.reduce((count, document) => count + document.chunk_count, 0));
      setMemories(fetchedMemories);
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Failed to load settings");
    } finally {
      setMemoriesLoading(false);
    }
  }

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  const aiMode = useMemo(
    () => (settings?.llm_provider === "ollama" ? "local" : "cloud"),
    [settings?.llm_provider],
  );


  async function handleSave() {
    if (!settings) {
      return;
    }

    setSaving(true);
    try {
      const updated = await saveSettings(settings);
      setSettings(updated);
      await load();
      pushToast({ tone: "success", title: "Settings saved" });
    } catch (reason) {
      const nextMessage = reason instanceof Error ? reason.message : "Failed to save settings";
      setMessage(nextMessage);
      pushToast({ tone: "error", title: "Save failed", description: nextMessage });
    } finally {
      setSaving(false);
    }
  }

  async function handleReindex() {
    setSaving(true);
    try {
      await reindexDocuments();
      await load();
      pushToast({ tone: "success", title: "Re-index complete" });
    } catch (reason) {
      const nextMessage = reason instanceof Error ? reason.message : "Re-index failed";
      setMessage(nextMessage);
      pushToast({ tone: "error", title: "Re-index failed", description: nextMessage });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetKnowledgeBase() {
    setSaving(true);
    try {
      const documents = await fetchDocuments();
      for (const document of documents) {
        await deleteDocument(document.id);
      }
      await load();
      pushToast({ tone: "success", title: "Knowledge base reset" });
    } catch (reason) {
      const nextMessage = reason instanceof Error ? reason.message : "Reset failed";
      setMessage(nextMessage);
      pushToast({ tone: "error", title: "Reset failed", description: nextMessage });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetOnboarding() {
    setSaving(true);
    try {
      const updated = await saveSettings({
        onboarding_complete: false,
        workspace_name: "",
        workspace_description: "",
        user_role: "",
        language: "English",
        tone: "balanced",
        response_length: "detailed",
        standing_context: "",
      });
      setSettings(updated);
      pushToast({ tone: "success", title: "Onboarding reset" });
      router.replace("/onboarding");
    } catch (reason) {
      const nextMessage = reason instanceof Error ? reason.message : "Reset failed";
      setMessage(nextMessage);
      pushToast({ tone: "error", title: "Reset failed", description: nextMessage });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="panel p-6 text-sm text-[var(--text-secondary)]">Loading settings...</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <p className="section-label">Settings</p>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Configure the workspace</h1>
        <p className="max-w-3xl text-[13px] leading-6 text-[var(--text-secondary)]">
          Configure providers, inspect data storage, and control debug visibility without leaving the app.
        </p>
      </header>

      {settings.reindex_required ? (
        <StatusBanner
          tone="warning"
          title="Re-index required"
          body="The current embedding setup no longer matches the indexed chunks."
          action={
            <button type="button" onClick={() => void handleReindex()} disabled={saving} className="button-primary">
              {saving ? "Working..." : "Run re-index"}
            </button>
          }
        />
      ) : null}

      {message ? <StatusBanner tone="warning" title="Settings message" body={message} /> : null}

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-text)]"
                : "rounded-full border border-transparent px-3 py-1.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            }
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Advanced" ? (
        <div className="space-y-4">
          <SettingsPanel title="AI Engine" description="Choose between local-first privacy or high-performance cloud models.">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  updateField("llm_provider", "ollama");
                  updateField("embedding_provider", "ollama");
                }}
                className={`panel flex flex-col items-start gap-2 p-4 text-left transition-all ${
                  settings.llm_provider === "ollama"
                    ? "border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--border-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-[13px] font-bold ${settings.llm_provider === "ollama" ? "text-[var(--accent-text)]" : "text-[var(--text-primary)]"}`}>Local Engine</span>
                  {settings.llm_provider === "ollama" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                </div>
                <p className={`text-[12px] leading-5 ${settings.llm_provider === "ollama" ? "text-[var(--accent-text)] opacity-80" : "text-[var(--text-secondary)]"}`}>
                  Everything stays on your device. Powered by Ollama. Best for privacy.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateField("llm_provider", "openai");
                  updateField("embedding_provider", "openai");
                }}
                className={`panel flex flex-col items-start gap-2 p-4 text-left transition-all ${
                  settings.llm_provider !== "ollama"
                    ? "border-[var(--accent)] bg-[var(--accent-light)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--border-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-[13px] font-bold ${settings.llm_provider !== "ollama" ? "text-[var(--accent-text)]" : "text-[var(--text-primary)]"}`}>Cloud Engine</span>
                  {settings.llm_provider !== "ollama" && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                </div>
                <p className={`text-[12px] leading-5 ${settings.llm_provider !== "ollama" ? "text-[var(--accent-text)] opacity-80" : "text-[var(--text-secondary)]"}`}>
                  High-speed, state-of-the-art models. Requires an external API key.
                </p>
              </button>
            </div>

            <div className="mt-6 space-y-4 border-t border-[var(--border-soft)] pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Model Provider</span>
                  <select
                    value={settings.llm_provider}
                    onChange={(event) => updateField("llm_provider", event.target.value as Settings["llm_provider"])}
                    className="select"
                  >
                    <option value="ollama">Ollama (Local)</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Chat Model</span>
                  <input
                    list="chat-models"
                    value={settings.llm_model}
                    onChange={(event) => updateField("llm_model", event.target.value)}
                    className="input"
                    placeholder="e.g. gpt-4o or llama3"
                  />
                  <datalist id="chat-models">
                    {settings.recommended_chat_models?.map(m => <option key={m} value={m} />)}
                  </datalist>
                </label>
                {settings.llm_provider !== "ollama" ? (
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">API Key</span>
                    <input
                      type="password"
                      value={settings.llm_api_key ?? ""}
                      onChange={(event) => updateField("llm_api_key", event.target.value)}
                      placeholder={`Enter your ${settings.llm_provider} API key`}
                      className="input"
                    />
                  </label>
                ) : null}
              </div>
              {settings.llm_provider === "ollama" ? (
                <div className="mt-2">
                  <OllamaStatus enabled buttonLabel="Check connection" />
                </div>
              ) : null}
            </div>
          </SettingsPanel>

          <SettingsPanel title="Orchestration & Routing" description="Configure automatic model switching and ingestion processing pipelines.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Automatic Mode (Semantic Routing)</span>
                  <button
                    type="button"
                    onClick={() => updateField("semantic_routing_enabled", !settings.semantic_routing_enabled)}
                    className={`relative inline-flex h-6 w-11 rounded-full border transition-colors ${
                        settings.semantic_routing_enabled
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--border-strong)] bg-[var(--bg-page)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-[var(--bg-surface)] transition-transform ${
                          settings.semantic_routing_enabled ? "translate-x-[21px]" : "translate-x-0.5"
                        }`}
                      />
                  </button>
                </div>
                <p className="text-xs leading-5 text-[var(--text-secondary)] mt-1">If enabled, the app instantly reads your questions before answering. Simple requests automatically route to the tiny, cheap Enrichment Model instead of the main brain.</p>
              </label>
              
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Fast Enrichment Model</span>
                <input
                  list="enrichment-models"
                  value={settings.enrichment_model ?? ""}
                  onChange={(event) => updateField("enrichment_model", event.target.value)}
                  className="input"
                  placeholder="e.g. llama3.2:1b"
                />
                <datalist id="enrichment-models">
                  {settings.recommended_enrichment_models?.map(m => <option key={m} value={m} />)}
                </datalist>
                <p className="text-xs text-[var(--text-muted)] mt-1">Used for high-speed background ingestion summaries and Automatic Mode semantic routing.</p>
              </label>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Retrieval controls" description="Debug mode reveals retrieval details inside chat.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Debug mode</span>
                <button
                  type="button"
                  onClick={() => updateField("developer_mode", !settings.developer_mode)}
                  aria-pressed={settings.developer_mode}
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-active)]"
                >
                  <span className="text-sm text-[var(--text-primary)]">Show retrieved chunks and scores</span>
                  <span
                    className={`relative inline-flex h-6 w-11 rounded-full border transition-colors ${
                      settings.developer_mode
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border-strong)] bg-[var(--bg-page)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-[var(--bg-surface)] transition-transform ${
                        settings.developer_mode ? "translate-x-[21px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Top-k retrieval</span>
                <input
                  type="number"
                  value={settings.top_k}
                  onChange={(event) => updateField("top_k", Number(event.target.value))}
                  className="input"
                />
              </label>
            </div>

            {settings.developer_mode ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Embedding provider</span>
                  <select
                    value={settings.embedding_provider}
                    onChange={(event) =>
                      updateField("embedding_provider", event.target.value as Settings["embedding_provider"])
                    }
                    className="input"
                  >
                    {settings.supported_embedding_providers.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Embedding model</span>
                  <input
                    list="embedding-models"
                    value={settings.embedding_model}
                    onChange={(event) => updateField("embedding_model", event.target.value)}
                    className="input"
                  />
                  <datalist id="embedding-models">
                    {settings.recommended_embedding_models?.map(m => <option key={m} value={m} />)}
                  </datalist>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Embedding API key</span>
                  <input
                    type="password"
                    value={settings.embedding_api_key ?? ""}
                    onChange={(event) => updateField("embedding_api_key", event.target.value)}
                    className="input"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Chunk size</span>
                  <input
                    type="number"
                    value={settings.chunk_size}
                    onChange={(event) => updateField("chunk_size", Number(event.target.value))}
                    className="input"
                  />
                </label>
              </div>
            ) : null}
          </SettingsPanel>


          <div className="flex justify-end">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="button-primary">
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "General" ? (
        <div className="space-y-4">
          <SettingsPanel title="Appearance" description="Tune the base typography and accent color for the workspace.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Base font size</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={14}
                    max={18}
                    step={1}
                    value={settings.ui_font_size}
                    onChange={(event) => updateField("ui_font_size", Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                  <span className="w-12 text-right text-sm text-[var(--text-secondary)]">{settings.ui_font_size}px</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Changes the base text size across the app.</p>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Accent color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.ui_accent_color}
                    onChange={(event) => updateField("ui_accent_color", event.target.value.toLowerCase())}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-1"
                  />
                  <input value={settings.ui_accent_color} readOnly className="input" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">Used for primary actions and selection states.</p>
              </label>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Workspace context" description="Update the information collected during onboarding.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Workspace name</span>
                <input
                  value={settings.workspace_name}
                  onChange={(event) => updateField("workspace_name", event.target.value)}
                  className="input"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Your name</span>
                <input
                  value={settings.user_name ?? ""}
                  onChange={(event) => updateField("user_name", event.target.value)}
                  className="input"
                  placeholder="e.g. Ricardo"
                />
                <p className="text-xs text-[var(--text-muted)]">How the AI should address you.</p>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Workspace description</span>
                <textarea
                  rows={3}
                  value={settings.workspace_description}
                  onChange={(event) => updateField("workspace_description", event.target.value)}
                  className="textarea"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Your role</span>
                <input
                  value={settings.user_role}
                  onChange={(event) => updateField("user_role", event.target.value)}
                  className="input"
                />
              </label>
            </div>
          </SettingsPanel>

          <SettingsPanel title="AI instructions" description="Control tone, language, and the standing context applied to every conversation.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Language</span>
                <select
                  value={settings.language}
                  onChange={(event) => updateField("language", event.target.value)}
                  className="select"
                >
                  <option value="English">English</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Tone</span>
                <select
                  value={settings.tone}
                  onChange={(event) => updateField("tone", event.target.value as Settings["tone"])}
                  className="select"
                >
                  <option value="professional">Professional</option>
                  <option value="balanced">Balanced</option>
                  <option value="casual">Casual</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Response length</span>
                <select
                  value={settings.response_length}
                  onChange={(event) => updateField("response_length", event.target.value as Settings["response_length"])}
                  className="select"
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Standing context</span>
                <textarea
                  rows={4}
                  value={settings.standing_context}
                  onChange={(event) => updateField("standing_context", event.target.value)}
                  className="textarea min-h-[120px]"
                />
              </label>
            </div>
          </SettingsPanel>

          <SettingsPanel title="Onboarding" description="Reopen the intro flow and re-enter workspace context.">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">This will send you back to the onboarding screens.</p>
              <button type="button" onClick={() => setConfirmAction("reset-onboarding")} disabled={saving} className="button-ghost">
                Reset onboarding
              </button>
            </div>
          </SettingsPanel>

          <div className="flex justify-end">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="button-primary">
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "Data" ? (
        <div className="space-y-4">
          <SettingsPanel title="Storage" description="Disk space used by the vector index and raw uploaded files.">
            <StoragePanel />
          </SettingsPanel>

          <SettingsPanel title="Maintenance" description="Use these actions carefully. They affect the stored knowledge base.">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void handleReindex()} disabled={saving} className="button-secondary">
                {saving ? "Working..." : "Re-index documents"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("reset-knowledge")}
                disabled={saving || documentCount === 0}
                className="inline-flex min-h-[32px] items-center justify-center rounded-lg border border-[color:rgba(217,119,6,0.28)] bg-[var(--warning-light)] px-3 text-[13px] font-medium text-[var(--warning)] transition-colors hover:bg-[var(--warning)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset knowledge base
              </button>
            </div>
          </SettingsPanel>
        </div>
      ) : null}

      {activeTab === "Memory" ? (
        <div className="space-y-4">
          <SettingsPanel title="AI Memory" description="Facts the AI has learned about you across conversations. Delete any memory you want it to forget.">
            <div className="space-y-2">
              {memoriesLoading ? (
                <p className="text-[13px] text-[var(--text-muted)]">Loading memories...</p>
              ) : memories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-subtle)] p-6 text-center">
                  <p className="text-[13px] text-[var(--text-muted)]">No memories yet</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">The AI will learn facts about you as you chat. They will appear here.</p>
                </div>
              ) : (
                memories.map((memory) => (
                  <div key={memory.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[var(--text-primary)]">{memory.fact}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Learned {new Date(memory.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteMemory(memory.id);
                          setMemories((prev) => prev.filter((m) => m.id !== memory.id));
                          pushToast({ tone: "success", title: "Memory removed" });
                        } catch {
                          pushToast({ tone: "error", title: "Failed to remove memory" });
                        }
                      }}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--danger)] dark:hover:bg-red-950"
                    >
                      Forget
                    </button>
                  </div>
                ))
              )}
            </div>
          </SettingsPanel>
        </div>
      ) : null}

      {activeTab === "About" ? (
        <div className="space-y-4">
          <SettingsPanel title="Local vs cloud" description="Choose the mode that matches your privacy and speed requirements.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel-raised rounded-xl p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Local</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Answer generation and embeddings run on your device. Your documents stay local unless you switch providers.
                </p>
              </div>
              <div className="panel-raised rounded-xl p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cloud</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  External providers can respond faster and with stronger models, but prompts and retrieved excerpts leave your machine.
                </p>
              </div>
            </div>
          </SettingsPanel>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmAction === "reset-knowledge"}
        title="Reset knowledge base?"
        description="This deletes every indexed document and its vectors. This cannot be undone."
        confirmLabel="Delete everything"
        tone="danger"
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          void handleResetKnowledgeBase();
        }}
      />
      <ConfirmDialog
        open={confirmAction === "reset-onboarding"}
        title="Reset onboarding?"
        description="You will be sent back to the intro flow to re-enter workspace context."
        confirmLabel="Reset onboarding"
        loading={saving}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          setConfirmAction(null);
          void handleResetOnboarding();
        }}
      />
    </div>
  );
}
