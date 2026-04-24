from __future__ import annotations

from typing import Literal
import re

ResponseMode = Literal["answer", "summary", "extract", "action_items", "timeline", "draft", "gaps"]

_MODE_PATTERNS: list[tuple[ResponseMode, tuple[str, ...]]] = [
    ("summary", ("summarize", "summary", "recap")),
    ("extract", ("extract", "list out", "pull out")),
    ("action_items", ("action items", "todo", "to-do", "next steps", "tasks")),
    ("timeline", ("timeline", "chronology", "milestones", "deadlines")),
    ("draft", ("draft", "write an email", "write a reply", "compose")),
    ("gaps", ("gaps", "missing", "unclear", "what's missing", "what is missing")),
]


def detect_response_mode(prompt: str) -> ResponseMode:
    lowered = prompt.lower()
    for mode, patterns in _MODE_PATTERNS:
        if any(pattern in lowered for pattern in patterns):
            return mode
    return "answer"


def classify_question(prompt: str) -> str:
    lowered = prompt.lower()
    if is_contradiction_query(prompt):
        return "contradiction"
    if is_comparison_query(prompt):
        return "comparison"
    if any(token in lowered for token in ("who", "what", "when", "where", "which", "how many")):
        return "factual"
    if any(token in lowered for token in ("explain", "why", "how does", "how do")):
        return "analysis"
    if len(lowered.split()) <= 3:
        return "ambiguous"
    return "fast"


def is_comparison_query(prompt: str) -> bool:
    lowered = prompt.lower()
    return any(token in lowered for token in ("compare", "difference", "differences", "vs ", "versus"))


def is_contradiction_query(prompt: str) -> bool:
    lowered = prompt.lower()
    return any(token in lowered for token in ("contradiction", "conflict", "inconsisten", "disagree"))


def get_explicit_doc_names(prompt: str, all_docs: list[str]) -> list[str]:
    lowered = prompt.lower()
    matches = [doc for doc in all_docs if doc.lower() in lowered]
    if matches:
        return matches

    bracket_matches = re.findall(r"\[([^\]]+)\]", prompt)
    return [match for match in bracket_matches if any(match.lower() in doc.lower() for doc in all_docs)]
