from __future__ import annotations

import bisect
from dataclasses import dataclass


@dataclass
class ChunkWithMeta:
    text: str
    chunk_index: int
    offset: int       # character start of this chunk in the full text
    page: int | None  # 1-based page number for PDFs; None for other file types
    parent_id: str | None = None # Used for Parent-Child contextual retrieval


def split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    text_length = len(normalized)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end < text_length:
            split_point = max(
                normalized.rfind("\n\n", start, end),
                normalized.rfind(". ", start, end),
                normalized.rfind(" ", start, end),
            )
            if split_point > start + int(chunk_size * 0.5):
                end = split_point + 1

        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= text_length:
            break

        next_start = max(end - overlap, start + 1)
        start = next_start

    return chunks


def split_text_with_meta(
    text: str,
    chunk_size: int,
    overlap: int,
    page_offsets: list[int],
) -> list[ChunkWithMeta]:
    """Like split_text but returns ChunkWithMeta objects with offset and page information."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    results: list[ChunkWithMeta] = []
    start = 0
    text_length = len(normalized)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        if end < text_length:
            split_point = max(
                normalized.rfind("\n\n", start, end),
                normalized.rfind(". ", start, end),
                normalized.rfind(" ", start, end),
            )
            if split_point > start + int(chunk_size * 0.5):
                end = split_point + 1

        chunk = normalized[start:end].strip()
        if chunk:
            chunk_index = len(results)
            page = _resolve_page(start, page_offsets)
            results.append(ChunkWithMeta(text=chunk, chunk_index=chunk_index, offset=start, page=page))

        if end >= text_length:
            break

        next_start = max(end - overlap, start + 1)
        start = next_start

    return results


import re

def split_text_structural(
    text: str,
    chunk_size: int,
    overlap: int,
    page_offsets: list[int],
) -> list[ChunkWithMeta]:
    """Structure-aware chunker for Markdown: respects headings, paragraphs, and sentences."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return []

    heading_pattern = re.compile(r'^(#{1,6})\s+(.*)$', re.MULTILINE)
    
    results: list[ChunkWithMeta] = []
    start = 0
    text_length = len(normalized)

    active_heading = None

    while start < text_length:
        # Find the active heading before this chunk starts to provide context
        matches_before = list(heading_pattern.finditer(normalized, 0, start))
        if matches_before:
            active_heading = matches_before[-1].group(0)

        end = min(start + chunk_size, text_length)
        if end < text_length:
            # 1. Try to split at a heading within the chunk window
            heading_matches = list(heading_pattern.finditer(normalized, start, end))
            # Find a heading match that isn't at the very beginning of the string (to make progress)
            valid_heading_starts = [m.start() for m in heading_matches if m.start() > start + int(chunk_size * 0.1)]
            
            if valid_heading_starts:
                split_point = valid_heading_starts[-1]  # split at the last valid heading in the window
            else:
                # 2. Fallback to paragraph break
                para_split = normalized.rfind("\n\n", start, end)
                if para_split > start + int(chunk_size * 0.2):
                    split_point = para_split + 2
                else:
                    # 3. Fallback to sentence break
                    sent_split = normalized.rfind(". ", start, end)
                    if sent_split > start + int(chunk_size * 0.2):
                        split_point = sent_split + 2
                    else:
                        # 4. Fallback to space
                        space_split = normalized.rfind(" ", start, end)
                        split_point = space_split + 1 if space_split > start else end
            
            end = split_point

        chunk_text = normalized[start:end].strip()
        
        # Inject structural context if the chunk doesn't already start with a heading
        if chunk_text and active_heading and not chunk_text.lstrip().startswith("#"):
            chunk_text = f"{active_heading}\n\n{chunk_text}"

        if chunk_text:
            chunk_index = len(results)
            page = _resolve_page(start, page_offsets)
            results.append(ChunkWithMeta(text=chunk_text, chunk_index=chunk_index, offset=start, page=page))

        if end >= text_length:
            break

        start = max(end - overlap, start + 1)

    return results


def _resolve_page(offset: int, page_offsets: list[int]) -> int | None:
    """Return 1-based page number for the given character offset, or None if page_offsets is empty."""
    if not page_offsets:
        return None
    # bisect_right gives us the index of the first page that starts AFTER offset,
    # so the page containing offset is one before that.
    index = bisect.bisect_right(page_offsets, offset) - 1
    return max(index, 0) + 1  # clamp to 0, convert to 1-based

@dataclass
class ParentChildChunk:
    parent_id: str
    parent_text: str
    children: list[ChunkWithMeta]

def split_text_parent_child(
    text: str,
    document_id: str,
    parent_size: int = 2000,
    child_size: int = 300,
    overlap: int = 50,
    page_offsets: list[int] | None = None,
) -> list[ParentChildChunk]:
    if page_offsets is None:
        page_offsets = []

    # First, split into parents
    parent_chunks = split_text_structural(text, parent_size, overlap=200, page_offsets=page_offsets)

    results: list[ParentChildChunk] = []
    
    for i, p_chunk in enumerate(parent_chunks):
        parent_id = f"{document_id}:parent:{i}"
        
        # Then, slice the parent into smaller children
        # We don't have page_offsets for the internal slice relative to the whole doc, so we just use overlap
        child_chunks_meta = split_text_with_meta(p_chunk.text, child_size, overlap, [])
        
        # We need to map the internal offset back to the global offset and page
        children: list[ChunkWithMeta] = []
        for c, c_chunk in enumerate(child_chunks_meta):
            global_offset = p_chunk.offset + c_chunk.offset
            global_page = _resolve_page(global_offset, page_offsets)
            children.append(ChunkWithMeta(
                text=c_chunk.text,
                chunk_index=c, # relative child index
                offset=global_offset,
                page=global_page,
                parent_id=parent_id
            ))
            
        if children:
            results.append(ParentChildChunk(
                parent_id=parent_id,
                parent_text=p_chunk.text,
                children=children
            ))

    return results

