"""ClaudeClient and AsyncClaudeClient entry points."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from .auth import OAuthCredentials, ensure_valid_token, load_credentials
from .messages import AsyncMessages, Messages

_DEFAULT_TIMEOUT = 600.0  # 10 minutes


class ClaudeClient:
    """Synchronous client for the Anthropic Messages API using Claude Code OAuth tokens.

    Usage::

        client = ClaudeClient()
        message = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": "Hello!"}],
        )
        print(message.text)
    """

    def __init__(
        self,
        *,
        credentials_path: str | Path | None = None,
        access_token: str | None = None,
        auto_refresh: bool = True,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._auto_refresh = auto_refresh
        self._creds: OAuthCredentials | None = None

        if access_token:
            # Manual token — no refresh possible
            self._creds = OAuthCredentials(
                access_token=access_token,
                refresh_token="",
                expires_at=0,
            )
            self._auto_refresh = False
        else:
            self._creds = load_credentials(credentials_path)

        self._http = httpx.Client(timeout=timeout)
        self._messages = Messages(self._http, self._get_token)

    def _get_token(self) -> str:
        if self._auto_refresh and self._creds:
            self._creds = ensure_valid_token(self._creds)
        return self._creds.access_token if self._creds else ""

    @property
    def messages(self) -> Messages:
        return self._messages

    @property
    def subscription_type(self) -> str:
        """Return the subscription type (always 'max' for OAuth tokens)."""
        return "max"

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> ClaudeClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


class AsyncClaudeClient:
    """Asynchronous client for the Anthropic Messages API using Claude Code OAuth tokens.

    Usage::

        async with AsyncClaudeClient() as client:
            message = await client.messages.create(
                model="claude-sonnet-4-5-20250514",
                max_tokens=1024,
                messages=[{"role": "user", "content": "Hello!"}],
            )
            print(message.text)
    """

    def __init__(
        self,
        *,
        credentials_path: str | Path | None = None,
        access_token: str | None = None,
        auto_refresh: bool = True,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        self._auto_refresh = auto_refresh
        self._creds: OAuthCredentials | None = None

        if access_token:
            self._creds = OAuthCredentials(
                access_token=access_token,
                refresh_token="",
                expires_at=0,
            )
            self._auto_refresh = False
        else:
            self._creds = load_credentials(credentials_path)

        self._http = httpx.AsyncClient(timeout=timeout)
        self._messages = AsyncMessages(self._http, self._get_token)

    async def _get_token(self) -> str:
        if self._auto_refresh and self._creds:
            self._creds = ensure_valid_token(self._creds)
        return self._creds.access_token if self._creds else ""

    @property
    def messages(self) -> AsyncMessages:
        return self._messages

    @property
    def subscription_type(self) -> str:
        return "max"

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> AsyncClaudeClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
