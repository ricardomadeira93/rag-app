"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlignLeft,
  AlertCircle,
  AlertTriangle,
  Brain,
  Calendar,
  CheckSquare,
  ChevronDown,
  Command,
  Download,
  FileText,
  Filter,
  GitCompare,
  Hash,
  Layers,
  Library,
  List,
  MessageSquare,
  Paperclip,
  PenLine,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { AttachmentChips } from "@/components/chat/AttachmentChips";
import { FileIcon } from "@/components/FileIcon";
import {
  RESPONSE_MODE_OPTIONS,
  type ComposerSubmitPayload,
  type DocumentRecord,
  type ResponseMode,
  type SourceRecord,
} from "@/lib/types";

type ChatInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  attachedDocuments: DocumentRecord[];
  availableDocuments: DocumentRecord[];
  availableSources: SourceRecord[];
  modelLabel?: string;
  semanticRouting?: boolean;
  recommendedModels?: string[];
  onModelChange?: (model: string) => void;
  onToggleRouting?: (enabled: boolean) => void;
  onRemoveAttachment: (id: string) => void;
  onAddAttachment: (document: DocumentRecord) => void;
  selectedMode: ResponseMode | null;
  displayMode: ResponseMode;
  onModeChange: (mode: ResponseMode | null) => void;
  onExecuteCommand: (commandId: string) => void;
  attachmentPickerSignal?: number;
};

type TriggerState =
  | { type: "mention"; query: string; rect: DOMRect | null }
  | { type: "tag"; query: string; rect: DOMRect | null }
  | { type: "command"; query: string };

type MentionSuggestion =
  | { kind: "document"; id: string; label: string; typeLabel: string; sizeLabel: string; fileType: string }
  | { kind: "source"; id: string; label: string; typeLabel: string; sizeLabel: string; fileType: string };

type TagSuggestion = { tag: string; count: number; create?: boolean };
type CommandItem = (typeof COMMANDS)[number];

const COMMANDS = [
  { id: "summary", label: "/summary", description: "Summarize documents", icon: AlignLeft, group: "RESPONSE MODES" },
  { id: "extract", label: "/extract", description: "Extract specific items", icon: List, group: "RESPONSE MODES" },
  { id: "actions", label: "/actions", description: "Find action items", icon: CheckSquare, group: "RESPONSE MODES" },
  { id: "timeline", label: "/timeline", description: "Build a timeline", icon: Calendar, group: "RESPONSE MODES" },
  { id: "draft", label: "/draft", description: "Draft something new", icon: PenLine, group: "RESPONSE MODES" },
  { id: "gaps", label: "/gaps", description: "Find what's missing", icon: AlertCircle, group: "RESPONSE MODES" },
  { id: "compare", label: "/compare", description: "Compare documents", icon: GitCompare, group: "RESPONSE MODES" },
  { id: "contradictions", label: "/contradictions", description: "Find conflicts", icon: AlertTriangle, group: "RESPONSE MODES" },
  { id: "upload", label: "/upload", description: "Upload a new file", icon: Upload, group: "DOCUMENT ACTIONS" },
  { id: "summarize-all", label: "/summarize-all", description: "Summarize all documents", icon: Layers, group: "DOCUMENT ACTIONS" },
  { id: "reindex", label: "/reindex", description: "Re-index all documents", icon: RefreshCw, group: "DOCUMENT ACTIONS" },
  { id: "clear", label: "/clear", description: "Clear this conversation", icon: Trash2, group: "CHAT ACTIONS" },
  { id: "export", label: "/export", description: "Export this conversation", icon: Download, group: "CHAT ACTIONS" },
  { id: "scope", label: "/scope", description: "Scope chat to specific docs", icon: Filter, group: "CHAT ACTIONS" },
  { id: "memory", label: "/memory", description: "View what AI remembers", icon: Brain, group: "CHAT ACTIONS" },
  { id: "documents", label: "/documents", description: "Go to documents", icon: Library, group: "NAVIGATION" },
  { id: "sources", label: "/sources", description: "Go to sources", icon: Plug, group: "NAVIGATION" },
  { id: "settings", label: "/settings", description: "Go to settings", icon: Settings, group: "NAVIGATION" },
] as const;

export function ChatInput({
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  loading = false,
  attachedDocuments,
  availableDocuments,
  availableSources,
  modelLabel = "Active model",
  semanticRouting,
  recommendedModels,
  onModelChange,
  onToggleRouting,
  onRemoveAttachment,
  onAddAttachment,
  selectedMode,
  displayMode,
  onModeChange,
  onExecuteCommand,
  attachmentPickerSignal = 0,
}: ChatInputProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedWords, setDismissedWords] = useState<string[]>([]);
  const [linkSuggestion, setLinkSuggestion] = useState<MentionSuggestion | null>(null);
  const lastExternalValueRef = useRef("");

  const attachableDocuments = useMemo(
    () =>
      availableDocuments
        .filter((document) => document.status === "indexed")
        .filter((document) => !attachedDocuments.some((attached) => attached.id === document.id))
        .slice(0, 8),
    [attachedDocuments, availableDocuments],
  );

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    availableDocuments.forEach((document) => {
      document.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return counts;
  }, [availableDocuments]);

  const mentionSuggestions = useMemo(() => {
    if (!trigger || trigger.type !== "mention") return [];
    const query = trigger.query.toLowerCase().trim();
    const documents = availableDocuments
      .filter((document) => document.status === "indexed")
      .filter((document) => {
        if (!query) return true;
        const full = document.filename.toLowerCase();
        const stem = full.replace(/\.[^.]+$/, "");
        return full.includes(query) || stem.includes(query);
      })
      .slice(0, 6)
      .map<MentionSuggestion>((document) => ({
        kind: "document",
        id: document.id,
        label: document.filename,
        typeLabel: document.file_type.toUpperCase(),
        sizeLabel: formatSize(document.file_size_bytes),
        fileType: document.file_type,
      }));

    const sources = availableSources
      .filter((source) => (!query ? true : source.name.toLowerCase().includes(query)))
      .slice(0, 4)
      .map<MentionSuggestion>((source) => ({
        kind: "source",
        id: source.id,
        label: source.name,
        typeLabel: "SOURCE",
        sizeLabel: source.items_indexed ? `${source.items_indexed} items` : "connector",
        fileType: "markdown",
      }));

    return [...documents, ...sources];
  }, [availableDocuments, availableSources, trigger]);

  const tagSuggestions = useMemo(() => {
    if (!trigger || trigger.type !== "tag") return [];
    const query = trigger.query.toLowerCase().trim();
    const existing = Array.from(tagCounts.entries())
      .filter(([tag]) => (!query ? true : tag.toLowerCase().includes(query)))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 6)
      .map<TagSuggestion>(([tag, count]) => ({ tag, count }));

    if (query && !existing.some((item) => item.tag.toLowerCase() === query)) {
      existing.push({ tag: query, count: 0, create: true });
    }

    return existing;
  }, [tagCounts, trigger]);

  const filteredCommands = useMemo(() => {
    const query = trigger && trigger.type === "command" ? trigger.query.toLowerCase().trim() : "";
    return COMMANDS.filter((command) => !query || command.label.toLowerCase().includes(query) || command.description.toLowerCase().includes(query));
  }, [trigger]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    filteredCommands.forEach((command) => {
      const current = groups.get(command.group) ?? [];
      groups.set(command.group, [...current, command]);
    });
    return Array.from(groups.entries());
  }, [filteredCommands]);

  const activeMode = RESPONSE_MODE_OPTIONS.find((option) => option.value === (selectedMode ?? displayMode)) ?? RESPONSE_MODE_OPTIONS[0];

  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastExternalValueRef.current) return;
    if (serializeEditor(editorRef.current).text === value) return;
    editorRef.current.innerHTML = "";
    if (value) {
      editorRef.current.appendChild(document.createTextNode(value));
      placeCaretAtEnd(editorRef.current);
    }
    lastExternalValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (attachmentPickerSignal > 0) {
      setPickerOpen(true);
    }
  }, [attachmentPickerSignal]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setTrigger({ type: "command", query: "" });
        setActiveIndex(0);
      }
    }

    window.addEventListener("keydown", handleGlobalShortcut as unknown as EventListener);
    return () => window.removeEventListener("keydown", handleGlobalShortcut as unknown as EventListener);
  }, []);

  function syncValue() {
    if (!editorRef.current) return;
    const serialized = serializeEditor(editorRef.current).text;
    lastExternalValueRef.current = serialized;
    onValueChange(serialized);
    detectPassiveLinkSuggestion(serialized);
  }

  function detectPassiveLinkSuggestion(text: string) {
    const lastWord = text.toLowerCase().split(/\s+/).pop() ?? "";
    if (!lastWord || lastWord.length < 4 || dismissedWords.includes(lastWord)) {
      setLinkSuggestion(null);
      return;
    }

    const bestMatch = availableDocuments
      .map((document) => {
        const stem = document.filename.replace(/\.[^.]+$/, "").toLowerCase();
        const full = document.filename.toLowerCase();
        if (!full.includes(lastWord) && !stem.includes(lastWord)) return null;
        return {
          kind: "document" as const,
          id: document.id,
          label: document.filename,
          typeLabel: document.file_type.toUpperCase(),
          sizeLabel: formatSize(document.file_size_bytes),
          fileType: document.file_type,
          confidence: lastWord.length / Math.max(stem.length, 1),
        };
      })
      .filter((item): item is (Extract<MentionSuggestion, { kind: "document" }> & { confidence: number }) => item !== null)
      .sort((left, right) => right.confidence - left.confidence)[0];

    if (bestMatch && bestMatch.confidence > 0.6) {
      setLinkSuggestion(bestMatch);
    } else {
      setLinkSuggestion(null);
    }
  }

  function handleInput() {
    syncValue();
    updateTriggerFromCaret();
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (trigger?.type === "mention" && mentionSuggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (current + delta + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMentionChip(mentionSuggestions[activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }

    if (trigger?.type === "tag" && tagSuggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (current + delta + tagSuggestions.length) % tagSuggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertTagChip(tagSuggestions[activeIndex].tag);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setTrigger(null);
        return;
      }
    }

    if (trigger?.type === "command") {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) => (current + delta + filteredCommands.length) % Math.max(filteredCommands.length, 1));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (filteredCommands[activeIndex]) {
          event.preventDefault();
          executeCommand(filteredCommands[activeIndex].id);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommandTrigger();
        return;
      }
    }

    if (linkSuggestion && event.key === "Tab" && !trigger) {
      event.preventDefault();
      insertPassiveSuggestedDoc(linkSuggestion);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitEditor();
      return;
    }

    if (event.key === "Backspace" && removeChipBeforeCaret()) {
      event.preventDefault();
      syncValue();
      return;
    }
  }

  function executeCommand(commandId: string) {
    setTrigger(null);
    removeSlashTrigger();
    onExecuteCommand(commandId);
  }

  function removeSlashTrigger() {
    if (!editorRef.current || !trigger || trigger.type !== "command") return;
    replaceCurrentTriggerText("");
    syncValue();
  }

  function closeCommandTrigger() {
    setTrigger(null);
  }

  function updateTriggerFromCaret() {
    if (!editorRef.current) return;
    const info = getCaretInfo(editorRef.current);
    if (!info) {
      setTrigger(null);
      return;
    }

    const mentionMatch = info.textBeforeCaret.match(/@([^\s@#/]*)$/);
    if (mentionMatch) {
      setTrigger({ type: "mention", query: mentionMatch[1], rect: info.rect });
      setActiveIndex(0);
      return;
    }

    const tagMatch = info.textBeforeCaret.match(/#([^\s@#/]*)$/);
    if (tagMatch) {
      setTrigger({ type: "tag", query: tagMatch[1], rect: info.rect });
      setActiveIndex(0);
      return;
    }

    const commandMatch = info.textBeforeCaret.match(/(^|\s)\/([^\s/]*)$/);
    if (commandMatch) {
      setTrigger({ type: "command", query: commandMatch[2] });
      setActiveIndex(0);
      return;
    }

    setTrigger(null);
  }

  function insertMentionChip(suggestion: MentionSuggestion) {
    if (suggestion.kind === "document") {
      insertChipNode("document", suggestion.id, suggestion.label);
    } else {
      insertChipNode("source", suggestion.id, suggestion.label);
    }
    setTrigger(null);
    setLinkSuggestion(null);
    syncValue();
  }

  function insertPassiveSuggestedDoc(suggestion: MentionSuggestion) {
    if (!editorRef.current || suggestion.kind !== "document") return;
    replaceLastWordWithChip(suggestion.id, suggestion.label, "document");
    setLinkSuggestion(null);
    syncValue();
  }

  function insertTagChip(tag: string) {
    insertChipNode("tag", tag, tag);
    setTrigger(null);
    syncValue();
  }

  function insertChipNode(kind: "document" | "tag" | "source", id: string, label: string) {
    replaceCurrentTriggerText("");
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const chip = createChipSpan(kind, id, label);
    range.insertNode(document.createTextNode(" "));
    range.insertNode(chip);
    range.collapse(false);
    range.insertNode(document.createTextNode(" "));
    placeCaretAfterNode(chip.nextSibling ?? chip);
  }

  async function submitEditor() {
    if (!editorRef.current) return;
    const payload = serializeEditor(editorRef.current);
    if (!payload.text.trim()) return;
    await onSubmit(payload);
    editorRef.current.innerHTML = "";
    onValueChange("");
    lastExternalValueRef.current = "";
    setTrigger(null);
    setLinkSuggestion(null);
  }

  return (
    <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex justify-center px-4 pb-4 md:left-[220px]">
      <div ref={composerRef} className="pointer-events-auto w-full max-w-[680px] rounded-t-2xl border-t border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-3">
        <div className="overflow-visible rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)]">
          <AttachmentChips documents={attachedDocuments} onRemove={onRemoveAttachment} />

          <AnimatePresence>
            {pickerOpen && attachableDocuments.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.16 }}
                className="border-b border-[var(--border-soft)] py-2"
              >
                {attachableDocuments.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => {
                      onAddAttachment(document);
                      setPickerOpen(false);
                    }}
                    className="flex h-8 w-full items-center justify-between px-4 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <span className="truncate">{document.filename}</span>
                    <Plus className="h-3 w-3" />
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="px-4 py-3">
            {selectedMode ? (
              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-text)]">
                <ModeIcon icon={activeMode.icon} className="h-3 w-3" />
                {activeMode.label}
                <button type="button" onClick={() => onModeChange(null)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            <div
              ref={editorRef}
              contentEditable={!disabled}
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleEditorKeyDown}
              onClick={updateTriggerFromCaret}
              className="min-h-[56px] max-h-[140px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-transparent text-[13px] leading-6 text-[var(--text-primary)] outline-none empty:before:pointer-events-none empty:before:text-[var(--text-muted)] empty:before:content-['Ask_about_your_documents...']"
            />

            {linkSuggestion ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span>Did you mean</span>
                <button type="button" onClick={() => insertPassiveSuggestedDoc(linkSuggestion)} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[var(--accent-text)]">
                  <FileText className="h-3 w-3" />
                  @{linkSuggestion.label}
                </button>
                <span>Press Tab to link it</span>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Attach document"
                  onClick={() => setPickerOpen((current) => !current)}
                  disabled={availableDocuments.length === 0}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTrigger({ type: "command", query: "" });
                    setActiveIndex(0);
                    editorRef.current?.focus();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <Command className="h-3.5 w-3.5" />
                  Commands
                </button>

                {onToggleRouting && semanticRouting !== undefined ? (
                  <button
                    type="button"
                    title="Semantic Routing (Automatic Mode)"
                    onClick={() => onToggleRouting(!semanticRouting)}
                    className={`flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      semanticRouting
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Zap className={`h-3 w-3 ${semanticRouting ? "fill-white/20" : ""}`} />
                    Auto
                  </button>
                ) : null}

                {onModelChange && recommendedModels ? (
                  <div className="relative flex items-center">
                    <select
                      value={modelLabel}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="h-6 w-full cursor-pointer appearance-none rounded-full bg-[var(--bg-subtle)] pl-3 pr-7 text-[11px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--line-subtle)] hover:text-[var(--text-primary)]"
                    >
                      {!recommendedModels.includes(modelLabel) ? <option value={modelLabel}>{modelLabel}</option> : null}
                      {recommendedModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 h-3 w-3 text-[var(--text-muted)]" />
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">{modelLabel}</span>
                )}
              </div>

              <button type="button" disabled={disabled || loading || !value.trim()} onClick={() => void submitEditor()} className="button-primary h-8 w-8 rounded-full p-0" title="Send">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {trigger?.type === "mention" ? (
            <InlinePopover rect={trigger.rect} width={280}>
              <div className="max-h-[220px] overflow-y-auto py-2">
                {mentionSuggestions.length > 0 ? (
                  <>
                    {mentionSuggestions.some((item) => item.kind === "document") ? <SectionHeader label="DOCUMENTS" /> : null}
                    {mentionSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.kind}-${suggestion.id}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertMentionChip(suggestion)}
                        className={`flex h-8 w-full items-center gap-2 px-3 text-left text-[12px] ${
                          index === activeIndex ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                        }`}
                      >
                        {suggestion.kind === "document" ? (
                          <FileIcon type={suggestion.fileType} filename={suggestion.label} className="h-3.5 w-3.5" />
                        ) : (
                          <Plug className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        )}
                        <span className="truncate text-[13px]">{suggestion.label}</span>
                        <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px]">{suggestion.typeLabel}</span>
                        <span className="ml-auto text-[11px] text-[var(--text-muted)]">{suggestion.sizeLabel}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="px-3 py-2 text-[12px] text-[var(--text-muted)]">
                    <div>No documents match &quot;@{trigger.query}&quot;</div>
                    <a href="/documents/upload" className="mt-1 inline-flex text-[var(--accent)]">Upload a file to mention it →</a>
                  </div>
                )}
              </div>
            </InlinePopover>
          ) : null}

          {trigger?.type === "tag" ? (
            <InlinePopover rect={trigger.rect} width={280}>
              <div className="max-h-[220px] overflow-y-auto py-2">
                <SectionHeader label="YOUR TAGS" />
                {tagSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.tag}-${suggestion.create ? "create" : "existing"}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertTagChip(suggestion.tag)}
                    className={`flex h-8 w-full items-center gap-2 px-3 text-left text-[12px] ${
                      index === activeIndex ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <Hash className="h-3.5 w-3.5 text-purple-500" />
                    <span className="truncate text-[13px]">{suggestion.create ? `Create tag "${suggestion.tag}"` : suggestion.tag}</span>
                    {!suggestion.create ? <span className="ml-auto text-[11px] text-[var(--text-muted)]">{suggestion.count} docs</span> : null}
                  </button>
                ))}
              </div>
            </InlinePopover>
          ) : null}

          {trigger?.type === "command" ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="pointer-events-auto absolute right-0 bottom-[120px] left-0 flex justify-center px-4"
            >
              <div className="w-full max-w-[480px] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <Command className="h-3.5 w-3.5" />
                    Commands
                  </div>
                  <span className="text-[11px]">esc to close</span>
                </div>
                <div className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">/{trigger.query}</div>
                <div className="max-h-[320px] overflow-y-auto pb-2">
                  {groupedCommands.map(([group, commands]) => (
                    <div key={group}>
                      <SectionHeader label={group} />
                      {commands.map((command) => {
                        const index = filteredCommands.findIndex((item) => item.id === command.id);
                        const Icon = command.icon;
                        return (
                          <button
                            key={command.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => executeCommand(command.id)}
                            className={`grid h-9 w-full grid-cols-[20px,1fr_auto] items-center gap-3 px-4 text-left ${
                              index === activeIndex ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-[13px] font-medium">{command.label}</span>
                            <span className="text-[12px] text-[var(--text-muted)]">{command.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <div className="px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</div>;
}

function InlinePopover({ rect, width, children }: { rect: DOMRect | null; width: number; children: React.ReactNode }) {
  const top = rect ? Math.max(rect.top - 12, 80) : 80;
  const left = rect ? Math.max(rect.left - 20, 24) : 24;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ position: "fixed", top, left, width, transform: "translateY(-100%)" }}
      className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
    >
      {children}
    </motion.div>
  );
}

function ModeIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case "AlignLeft":
      return <AlignLeft className={className} />;
    case "List":
      return <List className={className} />;
    case "CheckSquare":
      return <CheckSquare className={className} />;
    case "Calendar":
      return <Calendar className={className} />;
    case "PenLine":
      return <PenLine className={className} />;
    case "AlertCircle":
      return <AlertCircle className={className} />;
    default:
      return <MessageSquare className={className} />;
  }
}

function createChipSpan(kind: "document" | "tag" | "source", id: string, label: string) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.dataset.chipKind = kind;
  span.dataset.chipId = id;
  span.dataset.chipLabel = label;
  span.className =
    kind === "tag"
      ? "mx-[1px] inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-0.5 align-baseline text-[12px] text-purple-700"
      : "mx-[1px] inline-flex items-center gap-1 rounded-lg bg-[var(--accent-light)] px-2 py-0.5 align-baseline text-[12px] text-[var(--accent-text)]";
  span.textContent = kind === "tag" ? `#${label}` : `@${truncateLabel(label, 20)}`;
  return span;
}

function serializeEditor(editor: HTMLDivElement): ComposerSubmitPayload {
  const mentionedDocIds: string[] = [];
  const tags: string[] = [];
  let text = "";

  editor.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node instanceof HTMLElement && node.dataset.chipKind) {
      const kind = node.dataset.chipKind;
      const label = node.dataset.chipLabel ?? "";
      if (kind === "document") {
        text += `[@${label}]`;
        if (node.dataset.chipId) mentionedDocIds.push(node.dataset.chipId);
      } else if (kind === "tag") {
        text += `[#${label}]`;
        tags.push(label);
      } else {
        text += `[@${label}]`;
      }
    } else if (node.textContent) {
      text += node.textContent;
    }
  });

  return {
    text: text.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n"),
    mentionedDocIds: Array.from(new Set(mentionedDocIds)),
    tags: Array.from(new Set(tags)),
  };
}

function getCaretInfo(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(editor);
  preRange.setEnd(range.endContainer, range.endOffset);
  const rect = range.getBoundingClientRect();
  return {
    textBeforeCaret: preRange.toString(),
    rect,
  };
}

function replaceCurrentTriggerText(replacement: string) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return;
  const textNode = range.startContainer as Text;
  const before = textNode.textContent?.slice(0, range.startOffset) ?? "";
  const after = textNode.textContent?.slice(range.startOffset) ?? "";
  const nextBefore = before.replace(/(^|\s)[/@#][^\s/@#]*$/, replacement ? `${replacement}` : "");
  textNode.textContent = `${nextBefore}${after}`;
  const nextOffset = nextBefore.length;
  range.setStart(textNode, nextOffset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function replaceLastWordWithChip(id: string, label: string, kind: "document" | "tag" | "source") {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return;
  const textNode = range.startContainer as Text;
  const before = textNode.textContent?.slice(0, range.startOffset) ?? "";
  const after = textNode.textContent?.slice(range.startOffset) ?? "";
  const replaced = before.replace(/([^\s]+)$/, "");
  textNode.textContent = replaced + after;
  range.setStart(textNode, replaced.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  const chip = createChipSpan(kind, id, label);
  range.insertNode(chip);
  range.insertNode(document.createTextNode(" "));
  placeCaretAfterNode(chip.nextSibling ?? chip);
}

function removeChipBeforeCaret() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  let target: Node | null = null;

  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    if (range.startOffset !== 0) return false;
    target = range.startContainer.previousSibling;
  } else if (range.startContainer instanceof HTMLElement) {
    target = range.startContainer.childNodes[range.startOffset - 1] ?? null;
  }

  if (target instanceof HTMLElement && target.dataset.chipKind) {
    const previousSpace = target.previousSibling;
    target.remove();
    if (previousSpace?.nodeType === Node.TEXT_NODE && previousSpace.textContent === " ") {
      previousSpace.remove();
    }
    return true;
  }

  return false;
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAfterNode(node: Node) {
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStartAfter(node);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function truncateLabel(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
