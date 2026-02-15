"""OAuth credential loading, token refresh, and persistence."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

from .errors import CredentialsNotFoundError, TokenExpiredError

_DEFAULT_CREDENTIALS_PATH = Path.home() / ".claude" / ".credentials.json"
_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
_TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token"
_EXPIRY_BUFFER_MS = 5 * 60 * 1000  # 5 minutes


@dataclass
class OAuthCredentials:
    access_token: str
    refresh_token: str
    expires_at: int  # milliseconds since epoch
    account_uuid: str | None = None
    credentials_path: Path | None = None

    @property
    def is_expired(self) -> bool:
        now_ms = int(time.time() * 1000)
        return now_ms >= (self.expires_at - _EXPIRY_BUFFER_MS)


def load_credentials(path: Path | str | None = None) -> OAuthCredentials:
    """Read OAuth credentials from the Claude Code credentials file."""
    creds_path = Path(path) if path else _DEFAULT_CREDENTIALS_PATH

    if not creds_path.exists():
        raise CredentialsNotFoundError(
            f"Credentials file not found at {creds_path}. "
            "Make sure you're logged in with Claude Code."
        )

    try:
        raw = json.loads(creds_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise CredentialsNotFoundError(
            f"Failed to parse credentials file at {creds_path}: {exc}"
        ) from exc

    oauth = raw.get("claudeAiOauth")
    if not oauth:
        raise CredentialsNotFoundError(
            "No 'claudeAiOauth' key found in credentials file. "
            "Make sure you're logged in with Claude Code."
        )

    return OAuthCredentials(
        access_token=oauth["accessToken"],
        refresh_token=oauth["refreshToken"],
        expires_at=oauth["expiresAt"],
        account_uuid=oauth.get("accountUuid"),
        credentials_path=creds_path,
    )


def refresh_access_token(creds: OAuthCredentials) -> OAuthCredentials:
    """Refresh the access token using the refresh token.

    Returns a new OAuthCredentials with updated tokens.
    Raises TokenExpiredError if the refresh fails.
    """
    try:
        resp = httpx.post(
            _TOKEN_ENDPOINT,
            data={
                "grant_type": "refresh_token",
                "refresh_token": creds.refresh_token,
                "client_id": _OAUTH_CLIENT_ID,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise TokenExpiredError(
            f"Failed to refresh access token: {exc}"
        ) from exc

    body = resp.json()
    expires_in_s = body.get("expires_in", 28800)  # default 8h
    now_ms = int(time.time() * 1000)

    return OAuthCredentials(
        access_token=body["access_token"],
        refresh_token=body.get("refresh_token", creds.refresh_token),
        expires_at=now_ms + expires_in_s * 1000,
        account_uuid=creds.account_uuid,
        credentials_path=creds.credentials_path,
    )


def save_credentials(creds: OAuthCredentials) -> None:
    """Write updated tokens back to the credentials file."""
    if not creds.credentials_path:
        return

    path = creds.credentials_path

    # Read existing file to preserve other keys
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raw = {}
    else:
        raw = {}

    raw["claudeAiOauth"] = {
        "accessToken": creds.access_token,
        "refreshToken": creds.refresh_token,
        "expiresAt": creds.expires_at,
        **({"accountUuid": creds.account_uuid} if creds.account_uuid else {}),
    }

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")


def ensure_valid_token(creds: OAuthCredentials) -> OAuthCredentials:
    """Return valid credentials, refreshing and saving if expired."""
    if not creds.is_expired:
        return creds

    new_creds = refresh_access_token(creds)
    save_credentials(new_creds)
    return new_creds
