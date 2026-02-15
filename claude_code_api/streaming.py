"""SSE stream parsing and MessageStream wrappers."""

from __future__ import annotations

import json
from collections.abc import Generator, AsyncGenerator
from typing import Any

import httpx

from .types import (
    ContentBlockDelta,
    Message,
    MessageDelta,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    Usage,
    _parse_content_block,
)


def _parse_sse_lines(lines: list[str]) -> tuple[str | None, dict[str, Any] | None]:
    """Parse a batch of SSE lines into (event_type, data_dict)."""
    event_type = None
    data_parts: list[str] = []

    for line in lines:
        if line.startswith("event:"):
            event_type = line[len("event:"):].strip()
        elif line.startswith("data:"):
            data_parts.append(line[len("data:"):].strip())

    if not data_parts:
        return event_type, None

    raw = "\n".join(data_parts)
    try:
        return event_type, json.loads(raw)
    except json.JSONDecodeError:
        return event_type, None


class MessageStream:
    """Wraps an httpx streaming response and provides SSE parsing.

    Usage::

        with client.messages.stream(...) as stream:
            for text in stream.text_stream:
                print(text, end="")
        final = stream.get_final_message()
    """

    def __init__(self, response: httpx.Response) -> None:
        self._response = response
        self._events: list[tuple[str | None, dict[str, Any] | None]] = []
        self._final_message: Message | None = None
        self._started_message: dict[str, Any] | None = None

    def __enter__(self) -> MessageStream:
        return self

    def __exit__(self, *args: Any) -> None:
        self._response.close()

    def _iter_events(self) -> Generator[tuple[str | None, dict[str, Any] | None], None, None]:
        buf: list[str] = []
        for line in self._response.iter_lines():
            if line == "":
                if buf:
                    event = _parse_sse_lines(buf)
                    self._events.append(event)
                    yield event
                    buf = []
            else:
                buf.append(line)
        # Flush remaining
        if buf:
            event = _parse_sse_lines(buf)
            self._events.append(event)
            yield event

    @property
    def text_stream(self) -> Generator[str, None, None]:
        """Yield text chunks as they arrive."""
        for event_type, data in self._iter_events():
            if event_type == "message_start" and data:
                self._started_message = data.get("message")
            elif event_type == "content_block_delta" and data:
                delta = data.get("delta", {})
                if delta.get("type") == "text_delta" and delta.get("text"):
                    yield delta["text"]
            elif event_type == "message_delta" and data:
                msg_delta = MessageDelta.from_dict(data)
                if self._started_message is not None:
                    if msg_delta.stop_reason:
                        self._started_message["stop_reason"] = msg_delta.stop_reason
                    if msg_delta.usage:
                        existing = self._started_message.get("usage", {})
                        existing["output_tokens"] = msg_delta.usage.output_tokens
                        self._started_message["usage"] = existing

    def get_final_message(self) -> Message:
        """Return the assembled Message after the stream has been consumed."""
        if self._final_message is not None:
            return self._final_message

        # Build message from collected events
        message_data = dict(self._started_message) if self._started_message else {}
        content_blocks: list[dict[str, Any]] = []
        current_block: dict[str, Any] | None = None

        for event_type, data in self._events:
            if event_type == "message_start" and data:
                message_data = data.get("message", message_data)
            elif event_type == "content_block_start" and data:
                current_block = data.get("content_block", {})
            elif event_type == "content_block_delta" and data:
                if current_block is not None:
                    delta = data.get("delta", {})
                    delta_type = delta.get("type", "")
                    if delta_type == "text_delta":
                        current_block["text"] = current_block.get("text", "") + delta.get("text", "")
                    elif delta_type == "thinking_delta":
                        current_block["thinking"] = current_block.get("thinking", "") + delta.get("thinking", "")
                    elif delta_type == "input_json_delta":
                        current_block["_partial_json"] = current_block.get("_partial_json", "") + delta.get("partial_json", "")
            elif event_type == "content_block_stop":
                if current_block is not None:
                    # Finalize tool_use input from accumulated JSON
                    if current_block.get("type") == "tool_use" and "_partial_json" in current_block:
                        try:
                            current_block["input"] = json.loads(current_block.pop("_partial_json"))
                        except json.JSONDecodeError:
                            current_block["input"] = {}
                            current_block.pop("_partial_json", None)
                    content_blocks.append(current_block)
                    current_block = None
            elif event_type == "message_delta" and data:
                delta = data.get("delta", {})
                if "stop_reason" in delta:
                    message_data["stop_reason"] = delta["stop_reason"]
                usage = data.get("usage")
                if usage:
                    existing = message_data.get("usage", {})
                    existing["output_tokens"] = usage.get("output_tokens", existing.get("output_tokens", 0))
                    message_data["usage"] = existing

        message_data["content"] = content_blocks
        self._final_message = Message.from_dict(message_data)
        return self._final_message


class AsyncMessageStream:
    """Async counterpart to MessageStream."""

    def __init__(self, response: httpx.Response) -> None:
        self._response = response
        self._events: list[tuple[str | None, dict[str, Any] | None]] = []
        self._final_message: Message | None = None
        self._started_message: dict[str, Any] | None = None

    async def __aenter__(self) -> AsyncMessageStream:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._response.aclose()

    async def _iter_events(self) -> AsyncGenerator[tuple[str | None, dict[str, Any] | None], None]:
        buf: list[str] = []
        async for line in self._response.aiter_lines():
            if line == "":
                if buf:
                    event = _parse_sse_lines(buf)
                    self._events.append(event)
                    yield event
                    buf = []
            else:
                buf.append(line)
        if buf:
            event = _parse_sse_lines(buf)
            self._events.append(event)
            yield event

    @property
    async def text_stream(self) -> AsyncGenerator[str, None]:
        """Yield text chunks as they arrive (async)."""
        async for event_type, data in self._iter_events():
            if event_type == "message_start" and data:
                self._started_message = data.get("message")
            elif event_type == "content_block_delta" and data:
                delta = data.get("delta", {})
                if delta.get("type") == "text_delta" and delta.get("text"):
                    yield delta["text"]
            elif event_type == "message_delta" and data:
                msg_delta = MessageDelta.from_dict(data)
                if self._started_message is not None:
                    if msg_delta.stop_reason:
                        self._started_message["stop_reason"] = msg_delta.stop_reason
                    if msg_delta.usage:
                        existing = self._started_message.get("usage", {})
                        existing["output_tokens"] = msg_delta.usage.output_tokens
                        self._started_message["usage"] = existing

    def get_final_message(self) -> Message:
        """Return the assembled Message after the stream has been consumed."""
        if self._final_message is not None:
            return self._final_message

        message_data = dict(self._started_message) if self._started_message else {}
        content_blocks: list[dict[str, Any]] = []
        current_block: dict[str, Any] | None = None

        for event_type, data in self._events:
            if event_type == "message_start" and data:
                message_data = data.get("message", message_data)
            elif event_type == "content_block_start" and data:
                current_block = data.get("content_block", {})
            elif event_type == "content_block_delta" and data:
                if current_block is not None:
                    delta = data.get("delta", {})
                    delta_type = delta.get("type", "")
                    if delta_type == "text_delta":
                        current_block["text"] = current_block.get("text", "") + delta.get("text", "")
                    elif delta_type == "thinking_delta":
                        current_block["thinking"] = current_block.get("thinking", "") + delta.get("thinking", "")
                    elif delta_type == "input_json_delta":
                        current_block["_partial_json"] = current_block.get("_partial_json", "") + delta.get("partial_json", "")
            elif event_type == "content_block_stop":
                if current_block is not None:
                    if current_block.get("type") == "tool_use" and "_partial_json" in current_block:
                        try:
                            current_block["input"] = json.loads(current_block.pop("_partial_json"))
                        except json.JSONDecodeError:
                            current_block["input"] = {}
                            current_block.pop("_partial_json", None)
                    content_blocks.append(current_block)
                    current_block = None
            elif event_type == "message_delta" and data:
                delta = data.get("delta", {})
                if "stop_reason" in delta:
                    message_data["stop_reason"] = delta["stop_reason"]
                usage = data.get("usage")
                if usage:
                    existing = message_data.get("usage", {})
                    existing["output_tokens"] = usage.get("output_tokens", existing.get("output_tokens", 0))
                    message_data["usage"] = existing

        message_data["content"] = content_blocks
        self._final_message = Message.from_dict(message_data)
        return self._final_message
