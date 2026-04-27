export type LlmProvider = "ollama" | "openai" | "anthropic";
export type EmbeddingProvider = "ollama" | "openai";
export type ToneLiteral = "professional" | "balanced" | "casual";
export type ResponseLengthLiteral = "concise" | "detailed";
export type ResponseMode = "answer" | "summary" | "extract" | "action_items" | "timeline" | "draft" | "gaps";
export type ResponseModeOption = {
  value: ResponseMode;
  label: string;
  description: string;
  icon: string;
};

export const RESPONSE_MODE_OPTIONS: ResponseModeOption[] = [
  { value: "answer", label: "Answer", description: "Direct answer with citations", icon: "MessageSquare" },
  { value: "summary", label: "Summary", description: "Structured summary with key points", icon: "AlignLeft" },
  { value: "extract", label: "Extract", description: "Pull out specific items as a list", icon: "List" },
  { value: "action_items", label: "Action items", description: "Extract tasks, todos, and next steps", icon: "CheckSquare" },
  { value: "timeline", label: "Timeline", description: "Chronological extraction of events and dates", icon: "Calendar" },
  { value: "draft", label: "Draft", description: "Write something new based on document content", icon: "PenLine" },
  { value: "gaps", label: "Find gaps", description: "Identify what's missing or unclear", icon: "AlertCircle" },
];

export const QUICK_MODE_PROMPTS: Record<"summary" | "action_items" | "timeline" | "gaps", string> = {
  summary: "Summarize all my documents",
  action_items: "Extract all action items and next steps",
  timeline: "Create a timeline of all events and deadlines",
  gaps: "What's missing or unclear across my documents?",
};

export type EmbeddingSignature = {
  provider: EmbeddingProvider;
  model: string;
  version: string;
};

export type Settings = {
  current_workspace_id: string;
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
  tone: ToneLiteral;
  response_length: ResponseLengthLiteral;
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

export type SourceRecord = {
  id: string;
  name: string;
  status: "syncing" | "connected" | "manual" | "error" | "disconnected";
  description?: string | null;
  last_synced?: string | null;
  items_indexed?: number;
};

export type ComposerSubmitPayload = {
  text: string;
  mentionedDocIds: string[];
  tags: string[];
};

export type RelatedDocumentLink = {
  doc_id: string;
  filename: string;
  similarity?: number;
  reason?: string;
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
  related_docs: RelatedDocumentLink[];
  conflicting_docs: RelatedDocumentLink[];
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

export type ChatMeta = {
  confidence: "high" | "medium" | "low" | "none";
  answer_type: string;
  mode_used: ResponseMode;
  mode_auto_detected: boolean;
  analyzed_documents?: number | null;
  total_documents?: number | null;
  truncated?: boolean;
  message?: string | null;
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
  modeUsed?: ResponseMode;
  modeAutoDetected?: boolean;
  analyzedDocuments?: number;
  totalDocuments?: number;
  comparisonTruncated?: boolean;
  comparisonMessage?: string | null;
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
  workspace_id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type PersistedMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceCitation[];
  mode_used?: ResponseMode | null;
  mode_auto_detected?: boolean | null;
  rating: number | null;
  created_at: string;
};
