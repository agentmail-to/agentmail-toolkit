from typing import Optional

from agentmail.core import ApiError


def api_error_message(error: BaseException) -> str:
    """Extract a human-readable message from an AgentMail ApiError, mirroring
    node/src/util.ts's apiErrorMessage. Falls back to str(error) for non-API
    errors.
    """
    if not isinstance(error, ApiError):
        return str(error)

    body = error.body
    detail: Optional[str] = None
    if isinstance(body, dict):
        for key in ("message", "detail", "error"):
            value = body.get(key)
            if isinstance(value, str):
                detail = value
                break
    elif isinstance(body, str):
        detail = body
    elif body is not None:
        message = getattr(body, "message", None)
        if isinstance(message, str):
            detail = message
        else:
            errors = getattr(body, "errors", None)
            if errors is not None:
                detail = str(errors)

    base = detail or type(error).__name__
    return f"{base} (HTTP {error.status_code})" if error.status_code else base
