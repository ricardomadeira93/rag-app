"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBanner } from "@/components/status-banner";
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  fetchDocuments,
  fetchMemories,
  fetchMessages,
  fetchSettings,
  fetchSources,
  reindexDocuments,
  saveSettings,
  streamChat,
  togglePin,
} from "@/lib/api";
import type {
  ChatMessage as ChatMessageRecord,
  ChatMeta,
  ComposerSubmitPayload,
  Conversation,
  DocumentRecord,
  ResponseMode,
  RetrievalDebugInfo,
  Settings,
  SourceRecord,
  SourceCitation,
} from "@/lib/types";
import { Brain, Search, Pin, PinOff, Trash2, X } from "lucide-react";

export function ChatShell({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const [conversationMeta, setConversationMeta] = useState<Conversation | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<ResponseMode | null>(null);
  const [scopePickerSignal, setScopePickerSignal] = useState(0);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [memoryPanelOpen, setMemoryPanelOpen] = useState(false);
  const [memories, setMemories] = useState<Array<{ id: string; fact: string }>>([]);

  useEffect(() => {
    void Promise.all([fetchSettings(), fetchDocuments(), fetchSources().catch(() => [])])
      .then(([nextSettings, nextDocuments, nextSources]) => {
        setSettings(nextSettings);
        setDocuments(nextDocuments);
        setSources(nextSources);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    const documentIdsParam = searchParams.get("documents");
    if (prompt) {
      setInput(prompt);
    }
    if (documentIdsParam && documents.length > 0) {
      const ids = documentIdsParam.split(",").filter(Boolean);
      setAttachedDocuments(documents.filter((document) => ids.includes(document.id)));
    }
  }, [documents, searchParams]);

  // Fetch messages if a conversation ID is provided
  useEffect(() => {
    if (conversationId) {
      void Promise.all([
        fetchMessages(conversationId),
        fetchConversation(conversationId).catch(() => null)
      ]).then(([items, meta]) => {
        setMessages(items.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
          modeUsed: msg.mode_used ?? undefined,
          modeAutoDetected: msg.mode_auto_detected ?? undefined,
          debug: null, // Server doesn't persist debug info
          rating: msg.rating
        })));
        if (meta) setConversationMeta(meta);
      }).catch(() => setError("Failed to load conversation history"));
    } else {
      setMessages([]);
      setConversationMeta(null);
    }
  }, [conversationId]);

  useEffect(() => {
    // Only smooth scroll on final completion to prevent severe animation jitter during fast token streaming.
    if (scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ 
            behavior: loading ? "auto" : "smooth", 
            block: "end" 
        });
    }
  }, [messages, loading]);

  const recentDocuments = useMemo(
    () =>
      [...documents]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 6),
    [documents],
  );

  const suggestions = useMemo(() => {
    const workspaceName = settings?.workspace_name || "this workspace";
    const workspaceType = settings?.workspace_description || "my recent uploads";
    return [
      `Summarize the most important document in ${workspaceName}`,
      `What changed across ${workspaceType}?`,
      "Find the main risks and missing details",
      "What should I read first before I brief someone else?",
    ];
  }, [settings?.workspace_description, settings?.workspace_name]);

  async function sendMessage(
    submission: ComposerSubmitPayload,
    options?: {
      mode?: ResponseMode | null;
      baseMessages?: ChatMessageRecord[];
      appendUserMessage?: boolean;
      rerun?: boolean;
    },
  ) {
    const content = submission.text.trim();
    if (!content) {
      return;
    }

    if (settings?.reindex_required) {
      setError("Re-index your documents before starting a new chat.");
      return;
    }

    let targetConvId = activeConversationId;
    
    // Auto-create conversation if it's the first message
    if (!targetConvId) {
      try {
        const conv = await createConversation(content.slice(0, 40) + "...");
        targetConvId = conv.id;
        setActiveConversationId(targetConvId);
        // Soft replace URL to avoid interrupting stream
        window.history.replaceState(null, "", `/chat/${targetConvId}`);
      } catch (err) {
        setError("Failed to initialize conversation");
        return;
      }
    }

    const baseMessages = options?.baseMessages ?? messages;
    const appendUserMessage = options?.appendUserMessage ?? true;
    const mode = options?.mode ?? selectedMode;
    const requestMessages: ChatMessageRecord[] = appendUserMessage
      ? [...baseMessages, { role: "user", content }]
      : [...baseMessages];

    setMessages([...requestMessages, { role: "assistant", content: "", sources: [], debug: null, isThinking: true }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      await streamChat(
        requestMessages.map((message) => ({ role: message.role, content: message.content })),
        {
          debug: settings?.developer_mode,
          conversation_id: targetConvId,
          mode,
          rerun: Boolean(options?.rerun),
          filters: attachedDocuments.length > 0 ? { document_ids: attachedDocuments.map((document) => document.id) } : undefined,
          mentioned_doc_ids: submission.mentionedDocIds,
          tags: submission.tags,
          scoped_doc_ids: attachedDocuments.map((document) => document.id),
        },
        {
          onToken(token) {
            setMessages((current) => appendToAssistant(current, token));
          },
          onMeta(meta) {
            setMessages((current) => attachMeta(current, meta));
          },
          onSources(sources) {
            setMessages((current) => attachSources(current, sources));
          },
          onDebug(debug) {
            setMessages((current) => attachDebug(current, debug));
          },
          onError(message) {
            setError(message);
          },
        },
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(submission: ComposerSubmitPayload) {
    await sendMessage(submission);
  }

  function handleCopyAssistant(index: number) {
    const message = messages[index];
    if (!message || message.role !== "assistant") {
      return;
    }

    void navigator.clipboard.writeText(message.content).catch(() => {
      setError("Copy failed.");
    });
  }

  function handleRegenerate(index: number) {
    const previousUser = [...messages.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!previousUser) {
      return;
    }

    setMessages((current) => current.slice(0, index));
    void sendMessage({ text: previousUser.content, mentionedDocIds: [], tags: [] });
  }

  function handleSwitchMessageMode(index: number, mode: ResponseMode) {
    const history = messages.slice(0, index);
    const previousUser = [...history].reverse().find((message) => message.role === "user");
    if (!previousUser) {
      return;
    }

    setMessages(history);
    void sendMessage({ text: previousUser.content, mentionedDocIds: [], tags: [] }, {
      mode,
      baseMessages: history,
      appendUserMessage: false,
      rerun: true,
    });
  }

  const handleRate = async (index: number, rating: 1 | -1) => {
    const msg = messages[index];
    if (!msg || !msg.id) return;
    try {
      const api = await import("@/lib/api");
      await api.rateMessage(msg.id, rating);
      setMessages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], rating };
        return next;
      });
    } catch (err) {
      console.error("Failed to rate message", err);
    }
  };

  function addAttachment(document: DocumentRecord) {
    setAttachedDocuments((current) => [...current, document]);
  }

  function removeAttachment(documentId: string) {
    setAttachedDocuments((current) => current.filter((document) => document.id !== documentId));
  }

  async function handleTogglePin() {
    if (!activeConversationId || !conversationMeta) return;
    try {
      const nextPinned = !conversationMeta.pinned;
      setConversationMeta({ ...conversationMeta, pinned: nextPinned });
      await togglePin(activeConversationId);
    } catch {
      // Revert on error
      setConversationMeta({ ...conversationMeta, pinned: conversationMeta.pinned });
      setError("Failed to toggle pin");
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversationId) {
      return;
    }

    setDeletingConversation(true);
    try {
      await deleteConversation(activeConversationId);
      setMessages([]);
      setActiveConversationId(null);
      setConversationMeta(null);
      setDeleteConfirmOpen(false);
      router.push("/chat");
    } catch {
      setError("Failed to delete chat");
    } finally {
      setDeletingConversation(false);
    }
  }

  const displayedMessages = useMemo(() => {
    if (!searchQuery) return messages;
    const lowerQuery = searchQuery.toLowerCase();
    return messages.filter(msg => msg.content.toLowerCase().includes(lowerQuery));
  }, [messages, searchQuery]);

  async function handleSettingChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!settings) return;
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    try {
      await saveSettings({ [key]: value });
    } catch (reason) {
      setError(`Failed to update ${String(key)}`);
    }
  }

  async function handleExportConversation() {
    const content = messages
      .map((message) => `## ${message.role === "user" ? "User" : "Assistant"}\n\n${message.content}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${conversationMeta?.title || "conversation"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openMemoryPanel() {
    try {
      const items = await fetchMemories();
      setMemories(items.map((item) => ({ id: item.id, fact: item.fact })));
      setMemoryPanelOpen(true);
    } catch {
      setError("Failed to load memory");
    }
  }

  async function handleCommand(commandId: string) {
    if (commandId === "upload") {
      router.push("/documents/upload");
      setInput("");
      return;
    }
    if (commandId === "documents") {
      router.push("/documents");
      setInput("");
      return;
    }
    if (commandId === "sources") {
      router.push("/sources");
      setInput("");
      return;
    }
    if (commandId === "settings") {
      router.push("/settings");
      setInput("");
      return;
    }
    if (commandId === "clear") {
      setClearConfirmOpen(true);
      return;
    }
    if (commandId === "export") {
      await handleExportConversation();
      return;
    }
    if (commandId === "scope") {
      setScopePickerSignal((current) => current + 1);
      return;
    }
    if (commandId === "memory") {
      await openMemoryPanel();
      return;
    }
    if (commandId === "reindex") {
      await reindexDocuments();
      setError(null);
      return;
    }
    if (commandId === "summarize-all") {
      setSelectedMode("summary");
      setInput("Summarize all my documents");
      return;
    }
    if (commandId === "compare") {
      setSelectedMode(null);
      setInput("Compare all my documents");
      return;
    }
    if (commandId === "contradictions") {
      setSelectedMode(null);
      setInput("Do my documents contradict each other?");
      return;
    }
    if (commandId === "summary") setSelectedMode("summary");
    if (commandId === "extract") setSelectedMode("extract");
    if (commandId === "actions") setSelectedMode("action_items");
    if (commandId === "timeline") setSelectedMode("timeline");
    if (commandId === "draft") setSelectedMode("draft");
    if (commandId === "gaps") setSelectedMode("gaps");
  }

  return (
    <div className="relative min-h-[calc(100vh-72px)]">
      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col px-0 pb-28 pt-2">
        <div className="mx-auto w-full max-w-[680px] px-4">
          {activeConversationId && conversationMeta ? (
            <div className="mb-6 mt-2 flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
              {isSearching ? (
                <div className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]">
                  <Search className="h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    placeholder="Search in conversation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearching(false);
                      setSearchQuery("");
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-[14px] font-medium text-[var(--text-primary)] truncate pr-4">
                    {conversationMeta.title}
                  </h1>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsSearching(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="Search in chat"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleTogglePin()}
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        conversationMeta.pinned 
                          ? "text-[var(--accent)] hover:bg-[var(--accent-light)]" 
                          : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                      }`}
                      title={conversationMeta.pinned ? "Unpin chat" : "Pin chat"}
                    >
                      {conversationMeta.pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {settings?.reindex_required ? (
            <div className="mb-4">
              <StatusBanner
                tone="warning"
                title="Chat paused"
                body="The knowledge base needs a re-index before retrieval can continue."
              />
            </div>
          ) : null}

          {error ? (
            <div className="mb-4">
              <StatusBanner tone="warning" title="Chat error" body={error} />
            </div>
          ) : null}
        </div>

        <MessageList
          messages={displayedMessages}
          isStreaming={loading}
          workspaceName={settings?.workspace_name || "Workspace"}
          suggestions={suggestions}
          recentDocuments={recentDocuments}
          allDocuments={documents}
          onCopyAssistant={handleCopyAssistant}
          onRegenerate={handleRegenerate}
          onSaveAssistant={() => undefined}
          onSuggestionClick={setInput}
          onRate={handleRate}
          onModePromptClick={(mode, value) => {
            setSelectedMode(mode);
            setInput(value);
          }}
          onSwitchMessageMode={handleSwitchMessageMode}
        />

        <div ref={scrollAnchorRef} />
      </div>

      {clearConfirmOpen ? (
        <div className="pointer-events-none fixed right-0 bottom-[112px] left-0 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 py-3 text-[12px] shadow-[var(--shadow-soft)]">
            <span>Clear conversation?</span>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setActiveConversationId(null);
                setConversationMeta(null);
                setClearConfirmOpen(false);
                router.push("/chat");
              }}
              className="rounded-md bg-[var(--accent)] px-2 py-1 text-white"
            >
              Yes
            </button>
            <button type="button" onClick={() => setClearConfirmOpen(false)} className="rounded-md px-2 py-1 text-[var(--text-muted)]">
              No
            </button>
          </div>
        </div>
      ) : null}

      {memoryPanelOpen ? (
        <div className="fixed inset-x-4 top-20 z-30 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-soft)] sm:inset-x-auto sm:right-4 sm:w-[320px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
              <Brain className="h-4 w-4" />
              What AI remembers
            </div>
            <button type="button" onClick={() => setMemoryPanelOpen(false)} className="text-[var(--text-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
            {memories.length > 0 ? memories.map((memory) => (
              <div key={memory.id} className="rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
                {memory.fact}
              </div>
            )) : (
              <div className="text-[12px] text-[var(--text-muted)]">No stored memories yet.</div>
            )}
          </div>
        </div>
      ) : null}

      <ChatInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        disabled={Boolean(settings?.reindex_required)}
        loading={loading}
        modelLabel={settings?.llm_model || "Active model"}
        semanticRouting={settings?.semantic_routing_enabled}
        recommendedModels={settings?.recommended_chat_models || []}
        onModelChange={(model) => void handleSettingChange("llm_model", model)}
        onToggleRouting={(enabled) => void handleSettingChange("semantic_routing_enabled", enabled)}
        attachedDocuments={attachedDocuments}
        availableDocuments={documents}
        availableSources={sources}
        onRemoveAttachment={removeAttachment}
        onAddAttachment={addAttachment}
        selectedMode={selectedMode}
        displayMode={lastAssistantMode(messages)}
        onModeChange={setSelectedMode}
        onExecuteCommand={(commandId) => void handleCommand(commandId)}
        attachmentPickerSignal={scopePickerSignal}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete chat?"
        description={
          conversationMeta
            ? `Permanently delete "${conversationMeta.title}"?`
            : "Permanently delete this chat?"
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deletingConversation}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteConversation()}
      />
    </div>
  );
}

function appendToAssistant(messages: ChatMessageRecord[], token: string) {
  return messages.map((message, index) =>
    index === messages.length - 1 && message.role === "assistant"
      ? { ...message, content: `${message.content}${token}`, isThinking: false }
      : message,
  );
}

function attachMeta(messages: ChatMessageRecord[], meta: ChatMeta) {
  return messages.map((message, index) =>
    index === messages.length - 1 && message.role === "assistant" 
      ? {
          ...message,
          confidence: meta.confidence,
          answerType: meta.answer_type,
          modeUsed: meta.mode_used,
          modeAutoDetected: meta.mode_auto_detected,
          analyzedDocuments: meta.analyzed_documents ?? undefined,
          totalDocuments: meta.total_documents ?? undefined,
          comparisonTruncated: Boolean(meta.truncated),
          comparisonMessage: meta.message ?? null,
        }
      : message,
  );
}

function attachSources(messages: ChatMessageRecord[], sources: SourceCitation[]) {
  return messages.map((message, index) =>
    index === messages.length - 1 && message.role === "assistant" ? { ...message, sources } : message,
  );
}

function attachDebug(messages: ChatMessageRecord[], debug: RetrievalDebugInfo) {
  return messages.map((message, index) =>
    index === messages.length - 1 && message.role === "assistant" ? { ...message, debug } : message,
  );
}

function lastAssistantMode(messages: ChatMessageRecord[]): ResponseMode {
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.modeUsed);
  return lastAssistant?.modeUsed ?? "answer";
}
