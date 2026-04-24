from __future__ import annotations


def parse_slack_export(file_bytes: bytes) -> list[dict[str, object]]:
    text = file_bytes.decode("utf-8", errors="ignore")
    return [
        {
            "title": "slack-export",
            "content": text,
            "metadata": {
                "source_type": "slack",
                "doc_type": "message",
                "source_connector": "manual",
            },
        }
    ]
