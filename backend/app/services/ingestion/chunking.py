from __future__ import annotations

import bisect
from dataclasses import dataclass


@dataclass
class ChunkWithMeta:
    text: str
    chunk_index: int
    offset: int       # character start of this chunk in the full text
    page: int | None  # 1-based page number for PDFs; None for other file types


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


def _resolve_page(offset: int, page_offsets: list[int]) -> int | None:
    """Return 1-based page number for the given character offset, or None if page_offsets is empty."""
    if not page_offsets:
        return None
    # bisect_right gives us the index of the first page that starts AFTER offset,
    # so the page containing offset is one before that.
    index = bisect.bisect_right(page_offsets, offset) - 1
    return max(index, 0) + 1  # clamp to 0, convert to 1-based

