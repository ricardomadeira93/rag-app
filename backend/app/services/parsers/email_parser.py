from __future__ import annotations


def parse_eml(file_bytes: bytes) -> dict[str, object]:
    text = file_bytes.decode("utf-8", errors="ignore")
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "email")
    return {
        "title": first_line[:80] or "email",
        "content": text,
        "metadata": {
            "source_type": "email",
            "doc_type": "message",
            "source_connector": "manual",
        },
    }
