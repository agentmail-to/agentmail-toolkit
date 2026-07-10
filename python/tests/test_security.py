"""get_attachment security-hardening tests (security-audit.md items #1-#4):
https-only download, a timeout on the fetch, a size cap enforced before *and*
during download, and no bare `except:` swallowing errors silently.

No real network calls are made anywhere — urlopen is patched per test.
"""

from unittest.mock import patch

import pytest

from agentmail_toolkit import functions


def _kwargs():
    return {"inbox_id": "in_1", "thread_id": "th_1", "attachment_id": "att_1"}


def test_https_only_rejects_non_https_scheme(mock_client, make_attachment):
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="http://example.com/file"
    )

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        result = functions.get_attachment(mock_client, _kwargs())

    urlopen.assert_not_called()
    assert result.download_url == "http://example.com/file"
    assert not hasattr(result, "text") or result.model_dump().get("text") is None


def test_https_url_is_fetched_with_timeout(mock_client, make_attachment):
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="https://example.com/file.txt", size=5
    )

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        urlopen.return_value.read.return_value = b"hello"
        functions.get_attachment(mock_client, _kwargs())

    urlopen.assert_called_once()
    args, kwargs = urlopen.call_args
    assert args[0] == "https://example.com/file.txt"
    assert kwargs.get("timeout") == 15


def test_size_cap_rejects_oversized_attachment_without_fetching(
    mock_client, make_attachment
):
    """Pre-flight guard: attachment.size alone (already known from the
    metadata call) is enough to skip the download entirely."""
    oversized = functions.MAX_ATTACHMENT_BYTES + 1
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        size=oversized
    )

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        result = functions.get_attachment(mock_client, _kwargs())

    urlopen.assert_not_called()
    assert result.size == oversized


def test_size_cap_enforced_on_actual_body_not_just_header(mock_client, make_attachment):
    """Even if attachment.size lies (or an intermediary claims a smaller
    Content-Length), the bounded read() must catch an oversized body."""
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="https://example.com/file", size=10
    )
    oversized_body = b"x" * (functions.MAX_ATTACHMENT_BYTES + 1)

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        urlopen.return_value.read.return_value = oversized_body
        result = functions.get_attachment(mock_client, _kwargs())

    # Falls back to the bare attachment, no extracted text.
    assert result.model_dump().get("text") is None


def test_malformed_pdf_falls_back_gracefully_and_logs(
    mock_client, make_attachment, caplog
):
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="https://example.com/fake.pdf", size=5
    )
    bad_pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\nnot a real pdf body"

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        urlopen.return_value.read.return_value = bad_pdf
        with caplog.at_level("WARNING"):
            result = functions.get_attachment(mock_client, _kwargs())

    assert result.model_dump().get("text") is None
    assert any("att_1" in record.getMessage() for record in caplog.records)
    # The raw file body must never end up in the log.
    assert not any(bad_pdf in record.getMessage().encode() for record in caplog.records)


def test_malformed_docx_falls_back_gracefully_and_logs(
    mock_client, make_attachment, caplog
):
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="https://example.com/fake.docx", size=5
    )
    bad_zip = b"PK\x03\x04" + b"\x00" * 40

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        urlopen.return_value.read.return_value = bad_zip
        with caplog.at_level("WARNING"):
            result = functions.get_attachment(mock_client, _kwargs())

    assert result.model_dump().get("text") is None
    assert any("att_1" in record.getMessage() for record in caplog.records)


def test_extraction_failure_does_not_propagate_exception(mock_client, make_attachment):
    """Not just a bare except: — a real network/parse error during
    extraction must not crash the tool call."""
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        download_url="https://example.com/file", size=5
    )

    with patch("agentmail_toolkit.functions.urlopen") as urlopen:
        urlopen.side_effect = OSError("connection reset")
        result = functions.get_attachment(mock_client, _kwargs())

    assert result.attachment_id == "att_1"


def test_redirects_are_refused():
    """functions.urlopen is a no-redirect opener: a redirect response must not be
    followed (it could downgrade the https-only check to any target scheme)."""
    from agentmail_toolkit.functions import _NoRedirectHandler

    handler = _NoRedirectHandler()
    assert handler.redirect_request(None, None, 302, "Found", {}, "http://attacker.example/") is None


def test_api_error_message_is_bounded():
    from agentmail.core import ApiError

    from agentmail_toolkit.util import api_error_message

    error = ApiError(status_code=422, body={"message": "x" * 5000})
    message = api_error_message(error)
    assert len(message) < 600
    assert "(HTTP 422)" in message


def test_non_api_error_message_is_bounded():
    from agentmail_toolkit.util import api_error_message

    message = api_error_message(RuntimeError("y" * 5000))
    assert len(message) < 600
