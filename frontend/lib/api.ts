import {
  ChatFilters,
  ChatMeta,
  ChatScopingInfo,
  Conversation,
  DiskUsage,
  DocumentDetail,
  ChatMessage,
  DeleteDocumentResponse,
  DocumentRecord,
  OllamaStatus,
  PersistedMessage,
  ResponseMode,
  RetrievalDebugInfo,
  Settings,
  SourceRecord,
  SourceCitation,
  StorageUsage,
  Workspace,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      throw new Error(parsed.detail || body || `Request failed with ${response.status}`);
    } catch {
      throw new Error(body || `Request failed with ${response.status}`);
    }
  }
  return response.json() as Promise<T>;
}

export async function fetchSettings(): Promise<Settings> {
  const response = await fetch(`${API_URL}/settings`, { cache: "no-store" });
  return readJson<Settings>(response);
}

export async function saveSettings(payload: Partial<Settings>): Promise<Settings> {
  const response = await fetch(`${API_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<Settings>(response);
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${API_URL}/documents`, { cache: "no-store" });
  const data = await readJson<{ items: DocumentRecord[] }>(response);
  return data.items;
}

export async function fetchDocumentDetail(documentId: string): Promise<DocumentDetail> {
  const response = await fetch(`${API_URL}/documents/${documentId}`, { cache: "no-store" });
  return readJson<DocumentDetail>(response);
}

export async function uploadDocuments(files: File[]): Promise<DocumentRecord[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await readJson<{ items: DocumentRecord[] }>(response);
  return data.items;
}

export async function deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
  const response = await fetch(`${API_URL}/documents/${documentId}`, { method: "DELETE" });
  return readJson<DeleteDocumentResponse>(response);
}

export async function fetchSources(): Promise<SourceRecord[]> {
  const response = await fetch(`${API_URL}/sources`, { cache: "no-store" });
  return readJson<SourceRecord[]>(response);
}

export async function fetchAllTags(): Promise<string[]> {
  const response = await fetch(`${API_URL}/documents/tags`, { cache: "no-store" });
  return readJson<string[]>(response);
}

export async function updateDocumentTags(documentId: string, tags: string[]): Promise<DocumentRecord> {
  const response = await fetch(`${API_URL}/documents/${documentId}/tags`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
  return readJson<DocumentRecord>(response);
}

export async function connectSource(sourceId: string): Promise<{ auth_url: string }> {
  const response = await fetch(`${API_URL}/sources/${sourceId}/connect`, {
    method: "POST"
  });
  return readJson<{ auth_url: string }>(response);
}

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentRecord["status"],
): Promise<DocumentRecord> {
  const response = await fetch(`${API_URL}/documents/${documentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return readJson<DocumentRecord>(response);
}

export async function reindexDocuments(): Promise<void> {
  const response = await fetch(`${API_URL}/reindex`, { method: "POST" });
  await readJson(response);
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  const response = await fetch(`${API_URL}/ollama/status`, { cache: "no-store" });
  return readJson<OllamaStatus>(response);
}

export async function fetchStorageUsage(): Promise<StorageUsage> {
  const response = await fetch(`${API_URL}/storage/usage`, { cache: "no-store" });
  return readJson<StorageUsage>(response);
}

export async function fetchDiskUsage(): Promise<DiskUsage> {
  const response = await fetch(`${API_URL}/storage/disk`, { cache: "no-store" });
  return readJson<DiskUsage>(response);
}

export async function streamChat(
  messages: ChatMessage[],
  options: {
    debug?: boolean;
    filters?: ChatFilters;
    conversation_id?: string;
    mode?: ResponseMode | null;
    rerun?: boolean;
    mentioned_doc_ids?: string[];
    tags?: string[];
    scoped_doc_ids?: string[];
    workspace_id?: string | null;
  },
  handlers: {
    onToken: (token: string) => void;
    onSources: (sources: SourceCitation[]) => void;
    onMeta?: (meta: ChatMeta) => void;
    onScoping?: (scoping: ChatScopingInfo) => void;
    onDebug?: (debug: RetrievalDebugInfo) => void;
    onError: (message: string) => void;
  },
): Promise<void> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      messages,
      debug: Boolean(options.debug),
      filters: options.filters,
      conversation_id: options.conversation_id ?? null,
      mode: options.mode ?? null,
      rerun: Boolean(options.rerun),
      mentioned_doc_ids: options.mentioned_doc_ids ?? [],
      tags: options.tags ?? [],
      scoped_doc_ids: options.scoped_doc_ids ?? [],
      workspace_id: options.workspace_id ?? null,
    }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    try {
      const parsed = JSON.parse(errorBody) as { detail?: string };
      throw new Error(parsed.detail || errorBody || "Chat request failed");
    } catch {
      throw new Error(errorBody || "Chat request failed");
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventBlock of events) {
      const lines = eventBlock.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      if (!eventLine || !dataLine) {
        continue;
      }

      const event = eventLine.replace("event:", "").trim();
      const payload = JSON.parse(dataLine.replace("data:", "").trim());

      if (event === "token") {
        handlers.onToken(String(payload.content ?? ""));
      }
      if (event === "sources") {
        handlers.onSources((payload.items ?? []) as SourceCitation[]);
      }
      if (event === "scoping") {
        handlers.onScoping?.(payload as ChatScopingInfo);
      }
      if (event === "meta") {
        handlers.onMeta?.(payload as ChatMeta);
      }
      if (event === "debug") {
        handlers.onDebug?.(payload as RetrievalDebugInfo);
      }
      if (event === "error") {
        handlers.onError(String(payload.message ?? "Unknown error"));
      }
    }
  }
}

// ── Conversations ──────────────────────────────────────────────────────────

export async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/conversations`, { cache: "no-store" });
  return readJson<Conversation[]>(response);
}

export async function fetchConversation(conversationId: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations/${conversationId}`, { cache: "no-store" });
  return readJson<Conversation>(response);
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await fetch(`${API_URL}/workspaces`, { cache: "no-store" });
  return readJson<Workspace[]>(response);
}

export async function createWorkspace(name: string, description = ""): Promise<Workspace> {
  const response = await fetch(`${API_URL}/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return readJson<Workspace>(response);
}

export async function selectWorkspace(workspaceId: string): Promise<Workspace> {
  const response = await fetch(`${API_URL}/workspaces/${workspaceId}/select`, {
    method: "POST",
  });
  return readJson<Workspace>(response);
}

export async function createConversation(title?: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title ?? null }),
  });
  return readJson<Conversation>(response);
}

export async function fetchMessages(conversationId: string): Promise<PersistedMessage[]> {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    cache: "no-store",
  });
  return readJson<PersistedMessage[]>(response);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
    method: "DELETE",
  });
  await readJson(response);
}

export async function rateMessage(messageId: string, rating: 1 | -1): Promise<void> {
  const response = await fetch(`${API_URL}/messages/${messageId}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  await readJson(response);
}

export async function renameConversation(conversationId: string, title: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return readJson<Conversation>(response);
}

export async function togglePin(conversationId: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/pin`, {
    method: "POST",
  });
  return readJson<Conversation>(response);
}

export async function searchConversation(conversationId: string, query: string): Promise<PersistedMessage[]> {
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`,
    { cache: "no-store" },
  );
  return readJson<PersistedMessage[]>(response);
}



// ── Memories ──────────────────────────────────────────────────────────────────

export type MemoryItem = {
  id: string;
  fact: string;
  source_conversation_id: string | null;
  active: boolean;
  created_at: string;
};

export async function fetchMemories(): Promise<MemoryItem[]> {
  const response = await fetch(`${API_URL}/memories`, { cache: "no-store" });
  return readJson<MemoryItem[]>(response);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const response = await fetch(`${API_URL}/memories/${memoryId}`, {
    method: "DELETE",
  });
  await readJson(response);
}
