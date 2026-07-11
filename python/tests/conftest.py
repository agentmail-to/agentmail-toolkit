from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from agentmail.attachments.types.attachment_response import AttachmentResponse


@pytest.fixture
def mock_client():
    """A MagicMock shaped like the real agentmail.AgentMail client tree
    (client.inboxes.list, client.inboxes.threads.get_attachment, etc.) —
    every attribute access auto-vivifies another MagicMock, so nested calls
    like ``client.inboxes.threads.list(...)`` work without pre-wiring.
    """
    return MagicMock(name="AgentMail")


@pytest.fixture
def make_attachment():
    """Factory for a real AttachmentResponse SDK model with sane defaults."""

    def _make(**overrides):
        fields = {
            "attachment_id": "att_1",
            "size": 10,
            "download_url": "https://example.com/file",
            "expires_at": datetime.now(timezone.utc),
        }
        fields.update(overrides)
        return AttachmentResponse(**fields)

    return _make
