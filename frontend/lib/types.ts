export type LlmProvider = "ollama" | "openai" | "anthropic";
export type EmbeddingProvider = "ollama" | "openai";

export type EmbeddingSignature = {
  provider: EmbeddingProvider;
  model: string;
  version: string;
};

export type Settings = {
  developer_mode: boolean;
  llm_provider: LlmProvider;
  llm_model: string;
  llm_api_key: string | null;
  llm_base_url: string | null;
  embedding_provider: EmbeddingProvider;
  embedding_model: string;
  embedding_api_key: string | null;
  embedding_base_url: string | null;
  embedding_version: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  ui_font_size: number;
  ui_accent_color: string;
  ui_theme: "system" | "light" | "dark";
  onboarding_complete: boolean;
  workspace_name: string;
  workspace_description: string;
  user_name: string;
  user_role: string;
  language: string;
  tone: "professional" | "balanced" | "casual";
  response_length: "concise" | "detailed";
  standing_context: string;
  reindex_required: boolean;
  indexed_documents: number;
  current_embedding_signature: EmbeddingSignature;
  supported_llm_providers: LlmProvider[];
  supported_embedding_providers: EmbeddingProvider[];
  semantic_routing_enabled: boolean;
  enrichment_model: string | null;
  recommended_chat_models: string[];
  recommended_enrichment_models: string[];
  recommended_embedding_models: string[];
};

export type DocumentRecord = {
  id: string;
  filename: string;
  summary: string | null;
  document_type: string | null;
  topics: string[];
  mime_type: string;
  file_type: string;
  extension: string;
  checksum: string;
  source_path: string;
  extracted_text_path?: string | null;
  chunk_count: number;
  embedding_provider: string;
  embedding_model: string;
  embedding_version: string;
  status: "processing" | "indexed" | "failed" | "needs_reprocessing";
  indexed_at: string | null;
  error_message: string | null;
  file_size_bytes: number;  // 0 for pre-existing records
  source_type?: string;     // e.g. "upload", "gmail", "slack", "notion", "github"
  tags: string[];           // user-defined tags for organization
  created_at: string;
  updated_at: string;
};

export type SourceCitation = {
  id: string;
  document_id: string;
  filename: string;
  snippet: string;
  score: number;
  similarity_score: number;
  similarity_percent?: string;
  chunk_index: number;
  page: number | null;    // 1-based page for PDFs; null for other file types
  offset: number;         // character offset of chunk start in source text
  source_type?: string;
  created_at: string | null;
};

export type ChatFilters = {
  recent_only?: boolean;
  document_type?: string | null;
  created_after?: string | null;
  // Scoped retrieval
  document_ids?: string[];                                          // empty / omitted = full collection
  file_type?: "pdf" | "audio" | "image" | "markdown" | null;       // scoped to file type
  days?: number | null;                                             // recency window in days
};

export type ChatScopingInfo = {
  document_ids: string[];   // which document IDs were active (empty = full collection)
  file_type: string | null; // which file type filter was active
  days: number | null;      // which recency window was active
};

export type RetrievalDebugChunk = {
  id: string;
  document_id: string;
  filename: string;
  snippet: string;
  score: number;
  similarity_score: number;
  created_at: string | null;
};

export type RetrievalDebugInfo = {
  query: string;
  filters: Record<string, unknown>;
  embedding_model: string;
  chunks: RetrievalDebugChunk[];
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceCitation[];
  debug?: RetrievalDebugInfo | null;
  confidence?: "high" | "medium" | "low" | "none";
  answerType?: string;
  isThinking?: boolean;
  rating?: number | null;
};

export type OllamaStatus = {
  status: "running" | "not_running";
  models?: string[];
};

export type DeleteDocumentResponse = {
  id: string;
  deleted: boolean;
};

export type DocumentDetail = {
  item: DocumentRecord;
  content: string | null;
  file_size_bytes: number | null;
};

export type StorageDocumentItem = {
  id: string;
  name: string;
  file_size_bytes: number;
  chunk_count: number;
  indexed_at: string | null;
};

export type StorageUsage = {
  total_bytes: number;
  chroma_bytes: number;
  files_bytes: number;
  document_count: number;
  chunk_count: number;
  documents: StorageDocumentItem[];
};

export type DiskUsage = {
  total_bytes: number;
  free_bytes: number;
};

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type PersistedMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[];
  rating: number | null;
  created_at: string;
};
