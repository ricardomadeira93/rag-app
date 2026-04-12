"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { StatusBanner } from "@/components/status-banner";
import { fetchDocuments, fetchSettings, saveSettings, streamChat, createConversation, fetchMessages, fetchConversation, toggleConversationPin } from "@/lib/api";
import type { ChatMessage as ChatMessageRecord, DocumentRecord, RetrievalDebugInfo, Settings, SourceCitation, Conversation } from "@/lib/types";
import { Search, Pin, PinOff, X } from "lucide-react";

export function ChatShell({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const [conversationMeta, setConversationMeta] = useState<Conversation | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    void Promise.all([fetchSettings(), fetchDocuments()])
      .then(([nextSettings, nextDocuments]) => {
        setSettings(nextSettings);
        setDocuments(nextDocuments);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

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

  async function sendMessage(content: string) {
    if (!content.trim()) {
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

    const requestMessages: ChatMessageRecord[] = [...messages, { role: "user", content }];
    setMessages([...requestMessages, { role: "assistant", content: "", sources: [], debug: null, isThinking: true }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      await streamChat(
        requestMessages.map((message) => ({ role: message.role, content: message.content })),
        { debug: settings?.developer_mode, conversation_id: targetConvId },
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

  async function handleSubmit() {
    await sendMessage(input.trim());
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
    void sendMessage(previousUser.content);
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
      await toggleConversationPin(activeConversationId, nextPinned);
    } catch {
      // Revert on error
      setConversationMeta({ ...conversationMeta, pinned: conversationMeta.pinned });
      setError("Failed to toggle pin");
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
          onCopyAssistant={handleCopyAssistant}
          onRegenerate={handleRegenerate}
          onSaveAssistant={() => undefined}
          onSuggestionClick={setInput}
          onRate={handleRate}
        />

        <div ref={scrollAnchorRef} />
      </div>

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
        onRemoveAttachment={removeAttachment}
        onAddAttachment={addAttachment}
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

function attachMeta(messages: ChatMessageRecord[], meta: { confidence: any; answer_type: string }) {
  return messages.map((message, index) =>
    index === messages.length - 1 && message.role === "assistant" 
      ? { ...message, confidence: meta.confidence, answerType: meta.answer_type } 
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
