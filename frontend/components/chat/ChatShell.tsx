"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { StatusBanner } from "@/components/status-banner";
import { fetchDocuments, fetchSettings, saveSettings, streamChat, createConversation, fetchMessages } from "@/lib/api";
import type { ChatMessage as ChatMessageRecord, DocumentRecord, RetrievalDebugInfo, Settings, SourceCitation } from "@/lib/types";

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
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

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
      void fetchMessages(conversationId)
        .then((items) => {
          setMessages(items.map((msg) => ({
            role: msg.role,
            content: msg.content,
            sources: msg.sources,
            debug: null // Server doesn't persist debug info
          })));
        })
        .catch(() => setError("Failed to load conversation history"));
    } else {
      setMessages([]);
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
    setMessages([...requestMessages, { role: "assistant", content: "", sources: [], debug: null }]);
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

  function addAttachment(document: DocumentRecord) {
    setAttachedDocuments((current) => [...current, document]);
  }

  function removeAttachment(documentId: string) {
    setAttachedDocuments((current) => current.filter((document) => document.id !== documentId));
  }

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
          messages={messages}
          isStreaming={loading}
          workspaceName={settings?.workspace_name || "Workspace"}
          suggestions={suggestions}
          recentDocuments={recentDocuments}
          onCopyAssistant={handleCopyAssistant}
          onRegenerate={handleRegenerate}
          onSaveAssistant={() => undefined}
          onSuggestionClick={setInput}
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
      ? { ...message, content: `${message.content}${token}` }
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
