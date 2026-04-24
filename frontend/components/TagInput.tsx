"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

type TagInputProps = {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
};

type TagPillsProps = {
  tags: string[];
};

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function TagPills({ tags }: TagPillsProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-text)]"
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}

export function TagInput({ tags, suggestions, onChange }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const filteredSuggestions = useMemo(() => {
    const query = normalizeTag(draft);
    if (!query) {
      return suggestions.filter((tag) => !tags.includes(tag)).slice(0, 8);
    }
    return suggestions
      .filter((tag) => !tags.includes(tag) && tag.toLowerCase().includes(query))
      .slice(0, 8);
  }, [draft, suggestions, tags]);

  function addTag(rawValue: string) {
    const normalized = normalizeTag(rawValue);
    if (!normalized || tags.includes(normalized)) {
      return;
    }
    onChange([...tags, normalized]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((item) => item !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(draft);
          }
          if (event.key === "Backspace" && !draft && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        placeholder="Add a tag"
        className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />

      {filteredSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
