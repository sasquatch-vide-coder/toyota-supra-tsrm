"""Exception hierarchy for claude-code-api."""

from __future__ import annotations


class ClaudeCodeAPIError(Exception):
    """Base exception for all claude-code-api errors."""


class AuthenticationError(ClaudeCodeAPIError):
    """Raised when authentication fails."""


class TokenExpiredError(AuthenticationError):
    """Raised when the OAuth token has expired and could not be refreshed."""


class CredentialsNotFoundError(AuthenticationError):
    """Raised when the credentials file cannot be found or parsed."""


class APIError(ClaudeCodeAPIError):
    """Raised when the Anthropic API returns an error response."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        error_type: str | None = None,
        request_id: str | None = None,
    ) -> None:
        self.status_code = status_code
        self.error_type = error_type
        self.request_id = request_id
        super().__init__(message)


class RateLimitError(APIError):
    """Raised on 429 Too Many Requests."""

    def __init__(
        self,
        message: str,
        *,
        retry_after: float | None = None,
        request_id: str | None = None,
    ) -> None:
        self.retry_after = retry_after
        super().__init__(
            message,
            status_code=429,
            error_type="rate_limit_error",
            request_id=request_id,
        )


class OverloadedError(APIError):
    """Raised on 529 Overloaded."""

    def __init__(
        self,
        message: str,
        *,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message,
            status_code=529,
            error_type="overloaded_error",
            request_id=request_id,
        )
