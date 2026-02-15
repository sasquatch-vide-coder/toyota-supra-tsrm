"""Response types for the Anthropic Messages API."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Usage:
        return cls(
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            cache_creation_input_tokens=data.get("cache_creation_input_tokens", 0),
            cache_read_input_tokens=data.get("cache_read_input_tokens", 0),
        )


@dataclass
class TextBlock:
    text: str
    type: str = "text"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TextBlock:
        return cls(text=data["text"], type=data.get("type", "text"))


@dataclass
class ThinkingBlock:
    thinking: str
    type: str = "thinking"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ThinkingBlock:
        return cls(thinking=data["thinking"], type=data.get("type", "thinking"))


@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]
    type: str = "tool_use"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ToolUseBlock:
        return cls(
            id=data["id"],
            name=data["name"],
            input=data["input"],
            type=data.get("type", "tool_use"),
        )


ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock


def _parse_content_block(data: dict[str, Any]) -> ContentBlock:
    block_type = data.get("type")
    if block_type == "text":
        return TextBlock.from_dict(data)
    if block_type == "thinking":
        return ThinkingBlock.from_dict(data)
    if block_type == "tool_use":
        return ToolUseBlock.from_dict(data)
    return TextBlock.from_dict(data)


@dataclass
class ContentBlockDelta:
    """Delta event for streaming content blocks."""

    index: int
    type: str  # e.g. "text_delta", "thinking_delta", "input_json_delta"
    text: str | None = None
    thinking: str | None = None
    partial_json: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ContentBlockDelta:
        delta = data.get("delta", {})
        return cls(
            index=data.get("index", 0),
            type=delta.get("type", ""),
            text=delta.get("text"),
            thinking=delta.get("thinking"),
            partial_json=delta.get("partial_json"),
        )


@dataclass
class MessageDelta:
    """Delta event for the final message_delta SSE."""

    stop_reason: str | None = None
    stop_sequence: str | None = None
    usage: Usage | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> MessageDelta:
        delta = data.get("delta", {})
        usage_data = data.get("usage")
        return cls(
            stop_reason=delta.get("stop_reason"),
            stop_sequence=delta.get("stop_sequence"),
            usage=Usage.from_dict(usage_data) if usage_data else None,
        )


@dataclass
class Message:
    id: str
    role: str
    content: list[ContentBlock]
    model: str
    stop_reason: str | None
    stop_sequence: str | None
    usage: Usage
    type: str = "message"

    @property
    def text(self) -> str:
        """Concatenate all text blocks into a single string."""
        parts: list[str] = []
        for block in self.content:
            if isinstance(block, TextBlock):
                parts.append(block.text)
        return "".join(parts)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Message:
        return cls(
            id=data["id"],
            role=data["role"],
            content=[_parse_content_block(b) for b in data.get("content", [])],
            model=data["model"],
            stop_reason=data.get("stop_reason"),
            stop_sequence=data.get("stop_sequence"),
            usage=Usage.from_dict(data.get("usage", {})),
            type=data.get("type", "message"),
        )
