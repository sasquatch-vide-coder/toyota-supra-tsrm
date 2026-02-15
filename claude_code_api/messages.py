"""Messages resource — create() and stream() for the Anthropic Messages API."""

from __future__ import annotations

from contextlib import contextmanager, asynccontextmanager
from collections.abc import Generator, AsyncGenerator
from typing import Any, TYPE_CHECKING

import httpx

from .errors import APIError, RateLimitError, OverloadedError, AuthenticationError
from .streaming import MessageStream, AsyncMessageStream
from .types import Message

if TYPE_CHECKING:
    from .auth import OAuthCredentials

_API_BASE = "https://api.anthropic.com"
_API_VERSION = "2023-06-01"


def _raise_for_error(response: httpx.Response) -> None:
    """Raise an appropriate exception for error HTTP responses."""
    if response.status_code < 400:
        return

    request_id = response.headers.get("request-id")

    try:
        body = response.json()
        error_data = body.get("error", {})
        error_type = error_data.get("type", "unknown_error")
        message = error_data.get("message", response.text)
    except Exception:
        error_type = "unknown_error"
        message = response.text

    if response.status_code == 401:
        raise AuthenticationError(f"Authentication failed: {message}")

    if response.status_code == 429:
        retry_after = response.headers.get("retry-after")
        raise RateLimitError(
            message,
            retry_after=float(retry_after) if retry_after else None,
            request_id=request_id,
        )

    if response.status_code == 529:
        raise OverloadedError(message, request_id=request_id)

    raise APIError(
        message,
        status_code=response.status_code,
        error_type=error_type,
        request_id=request_id,
    )


def _build_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "anthropic-version": _API_VERSION,
        "anthropic-beta": "oauth-2025-04-20,interleaved-thinking-2025-05-14",
        "user-agent": "claude-code/2.1.2",
        "content-type": "application/json",
    }


class Messages:
    """Synchronous Messages resource."""

    def __init__(
        self,
        http_client: httpx.Client,
        get_token: Any,  # callable returning str
    ) -> None:
        self._http = http_client
        self._get_token = get_token

    def create(
        self,
        *,
        model: str,
        max_tokens: int,
        messages: list[dict[str, Any]],
        system: str | list[dict[str, Any]] | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        stop_sequences: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Message:
        """Send a non-streaming Messages API request."""
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system is not None:
            payload["system"] = system
        if temperature is not None:
            payload["temperature"] = temperature
        if top_p is not None:
            payload["top_p"] = top_p
        if top_k is not None:
            payload["top_k"] = top_k
        if stop_sequences is not None:
            payload["stop_sequences"] = stop_sequences
        if tools is not None:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if metadata is not None:
            payload["metadata"] = metadata
        payload.update(kwargs)

        token = self._get_token()
        resp = self._http.post(
            f"{_API_BASE}/v1/messages",
            json=payload,
            headers=_build_headers(token),
        )
        _raise_for_error(resp)
        return Message.from_dict(resp.json())

    @contextmanager
    def stream(
        self,
        *,
        model: str,
        max_tokens: int,
        messages: list[dict[str, Any]],
        system: str | list[dict[str, Any]] | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        stop_sequences: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Generator[MessageStream, None, None]:
        """Send a streaming Messages API request.

        Usage::

            with client.messages.stream(model=..., max_tokens=..., messages=...) as stream:
                for text in stream.text_stream:
                    print(text, end="")
        """
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "stream": True,
        }
        if system is not None:
            payload["system"] = system
        if temperature is not None:
            payload["temperature"] = temperature
        if top_p is not None:
            payload["top_p"] = top_p
        if top_k is not None:
            payload["top_k"] = top_k
        if stop_sequences is not None:
            payload["stop_sequences"] = stop_sequences
        if tools is not None:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if metadata is not None:
            payload["metadata"] = metadata
        payload.update(kwargs)

        token = self._get_token()
        with self._http.stream(
            "POST",
            f"{_API_BASE}/v1/messages",
            json=payload,
            headers=_build_headers(token),
        ) as resp:
            if resp.status_code >= 400:
                resp.read()
                _raise_for_error(resp)
            with MessageStream(resp) as stream:
                yield stream


class AsyncMessages:
    """Asynchronous Messages resource."""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        get_token: Any,  # async callable returning str
    ) -> None:
        self._http = http_client
        self._get_token = get_token

    async def create(
        self,
        *,
        model: str,
        max_tokens: int,
        messages: list[dict[str, Any]],
        system: str | list[dict[str, Any]] | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        stop_sequences: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> Message:
        """Send a non-streaming Messages API request (async)."""
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if system is not None:
            payload["system"] = system
        if temperature is not None:
            payload["temperature"] = temperature
        if top_p is not None:
            payload["top_p"] = top_p
        if top_k is not None:
            payload["top_k"] = top_k
        if stop_sequences is not None:
            payload["stop_sequences"] = stop_sequences
        if tools is not None:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if metadata is not None:
            payload["metadata"] = metadata
        payload.update(kwargs)

        token = await self._get_token()
        resp = await self._http.post(
            f"{_API_BASE}/v1/messages",
            json=payload,
            headers=_build_headers(token),
        )
        _raise_for_error(resp)
        return Message.from_dict(resp.json())

    @asynccontextmanager
    async def stream(
        self,
        *,
        model: str,
        max_tokens: int,
        messages: list[dict[str, Any]],
        system: str | list[dict[str, Any]] | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        stop_sequences: list[str] | None = None,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[AsyncMessageStream, None]:
        """Send a streaming Messages API request (async)."""
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "stream": True,
        }
        if system is not None:
            payload["system"] = system
        if temperature is not None:
            payload["temperature"] = temperature
        if top_p is not None:
            payload["top_p"] = top_p
        if top_k is not None:
            payload["top_k"] = top_k
        if stop_sequences is not None:
            payload["stop_sequences"] = stop_sequences
        if tools is not None:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if metadata is not None:
            payload["metadata"] = metadata
        payload.update(kwargs)

        token = await self._get_token()
        async with self._http.stream(
            "POST",
            f"{_API_BASE}/v1/messages",
            json=payload,
            headers=_build_headers(token),
        ) as resp:
            if resp.status_code >= 400:
                await resp.aread()
                _raise_for_error(resp)
            async with AsyncMessageStream(resp) as stream:
                yield stream
