import {
  ChatFilters,
  ChatScopingInfo,
  Conversation,
  DiskUsage,
  DocumentDetail,
  ChatMessage,
  DeleteDocumentResponse,
  DocumentRecord,
  OllamaStatus,
  PersistedMessage,
  RetrievalDebugInfo,
  Settings,
  SourceCitation,
  StorageUsage,
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
  },
  handlers: {
    onToken: (token: string) => void;
    onSources: (sources: SourceCitation[]) => void;
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
