"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { StatusBanner } from "@/components/status-banner";
import { fetchDocuments, fetchSettings, streamChat } from "@/lib/api";
import type { ChatMessage as ChatMessageRecord, DocumentRecord, RetrievalDebugInfo, Settings, SourceCitation } from "@/lib/types";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void Promise.all([fetchSettings(), fetchDocuments()])
      .then(([nextSettings, nextDocuments]) => {
        setSettings(nextSettings);
        setDocuments(nextDocuments);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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

    const requestMessages: ChatMessageRecord[] = [...messages, { role: "user", content }];
    setMessages([...requestMessages, { role: "assistant", content: "", sources: [], debug: null }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      await streamChat(
        requestMessages.map((message) => ({ role: message.role, content: message.content })),
        { debug: settings?.developer_mode },
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
