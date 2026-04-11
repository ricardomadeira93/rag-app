"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { OllamaStatus } from "@/components/OllamaStatus";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBanner } from "@/components/status-banner";
import { StoragePanel } from "@/components/StoragePanel";
import { useToast } from "@/components/toast-provider";
import { deleteDocument, fetchDocuments, fetchSettings, reindexDocuments, saveSettings } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { applyUiTheme } from "@/lib/ui-theme";

const tabs = ["General", "Identity", "Data", "About"] as const;
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
      const [nextSettings, documents] = await Promise.all([fetchSettings(), fetchDocuments()]);
      setSettings(nextSettings);
      setDocumentCount(documents.length);
      setChunkCount(documents.reduce((count, document) => count + document.chunk_count, 0));
      setMessage(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Failed to load settings");
    }
  }

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  const aiMode = useMemo(
    () => (settings?.llm_provider === "ollama" ? "local" : "cloud"),
    [settings?.llm_provider],
  );

  function aiModeCardClass(selected: boolean) {
    return [
      "panel p-4 text-left transition-colors duration-150",
      selected
        ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-text)]"
        : "hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]",
    ].join(" ");
  }

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

      {activeTab === "General" ? (
        <div className="space-y-4">
          {aiMode === "cloud" ? (
            <StatusBanner
              tone="warning"
              title="Cloud AI is enabled"
              body="Prompts and retrieved document excerpts may be sent to external providers."
            />
          ) : null}

          <SettingsPanel title="AI mode" description="Choose whether answers run locally or through a cloud provider.">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  updateField("llm_provider", "ollama");
                  updateField("embedding_provider", "ollama");
                  updateField("llm_api_key", null);
                  updateField("embedding_api_key", null);
                  updateField("llm_model", settings.llm_model || "llama3.1:8b");
                  updateField("embedding_model", settings.embedding_model || "nomic-embed-text");
                }}
                className={aiModeCardClass(aiMode === "local")}
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">Local AI</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Runs on your device with Ollama.</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateField("llm_provider", "openai");
                  updateField("embedding_provider", "openai");
                  updateField("llm_model", settings.llm_model || "gpt-4o-mini");
                  updateField("embedding_model", settings.embedding_model || "text-embedding-3-small");
                }}
                className={aiModeCardClass(aiMode === "cloud")}
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cloud AI</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Uses an external provider and needs API credentials.</p>
              </button>
            </div>
          </SettingsPanel>

          {aiMode === "local" ? (
            <SettingsPanel title="Local runtime" description="Use this to confirm the local model runtime is available.">
              <OllamaStatus enabled buttonLabel="Check again" />
            </SettingsPanel>
          ) : (
            <SettingsPanel title="Cloud provider" description="Set the provider and credentials used for answers.">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Provider</span>
                  <select
                    value={settings.llm_provider}
                    onChange={(event) => updateField("llm_provider", event.target.value as Settings["llm_provider"])}
                    className="input"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Model</span>
                  <input
                    value={settings.llm_model}
                    onChange={(event) => updateField("llm_model", event.target.value)}
                    className="input"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Answer API key</span>
                  <input
                    type="password"
                    value={settings.llm_api_key ?? ""}
                    onChange={(event) => updateField("llm_api_key", event.target.value)}
                    placeholder="Required for the selected provider"
                    className="input"
                  />
                </label>
              </div>
            </SettingsPanel>
          )}

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
                    value={settings.embedding_model}
                    onChange={(event) => updateField("embedding_model", event.target.value)}
                    className="input"
                  />
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

          <div className="flex justify-end">
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="button-primary">
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "Identity" ? (
        <div className="space-y-4">
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
