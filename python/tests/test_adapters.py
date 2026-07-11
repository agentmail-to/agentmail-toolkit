"""Per-framework adapter tests: error signaling (F5) and void-op handling (F2).

Each adapter wraps the same underlying tool.func; what differs is how a raised
exception and a None return get surfaced to the calling framework. The bar for
each adapter: a tool failure must be *distinguishable* from a tool success —
never returned as a plain string/value indistinguishable from real output.
"""

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from agentmail.core import ApiError
from agentmail.inboxes.types.inbox import Inbox
from langchain_core.tools import ToolException as LangchainToolException
from livekit.agents import ToolError as LivekitToolError


def make_inbox():
    return Inbox(
        pod_id="pod_1",
        inbox_id="in_1",
        email="in_1@agentmail.to",
        updated_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


API_ERROR = ApiError(status_code=404, body={"message": "Inbox not found"})


# --------------------------------------------------------------------------
# openai adapter
# --------------------------------------------------------------------------


def test_openai_success_returns_serialized_model(mock_client):
    from agentmail_toolkit.openai import AgentMailToolkit

    inbox = make_inbox()
    mock_client.inboxes.get.return_value = inbox
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    result = asyncio.run(
        tool.on_invoke_tool(MagicMock(), json.dumps({"inbox_id": "in_1"}))
    )

    assert result == inbox.model_dump_json()


def test_openai_void_op_returns_ok_not_crash(mock_client):
    """F2: delete_inbox returns None on success; must not AttributeError on
    .model_dump_json()."""
    from agentmail_toolkit.openai import AgentMailToolkit

    mock_client.inboxes.delete.return_value = None
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["delete_inbox"]

    result = asyncio.run(
        tool.on_invoke_tool(MagicMock(), json.dumps({"inbox_id": "in_1"}))
    )

    assert result == "OK"


def test_openai_error_path_raises_not_returns_string(mock_client):
    """F5: an API error must be raised (a real tool failure), never returned
    as an ordinary 'successful' string."""
    from agentmail_toolkit.openai import AgentMailToolkit

    mock_client.inboxes.get.side_effect = API_ERROR
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    with pytest.raises(RuntimeError, match="Inbox not found"):
        asyncio.run(
            tool.on_invoke_tool(MagicMock(), json.dumps({"inbox_id": "in_1"}))
        )


# --------------------------------------------------------------------------
# langchain adapter
# --------------------------------------------------------------------------


def test_langchain_success_invokes_without_error(mock_client):
    from agentmail_toolkit.langchain import AgentMailToolkit

    mock_client.inboxes.get.return_value = make_inbox()
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    result = tool.invoke({"inbox_id": "in_1"})

    assert result is not None


def test_langchain_void_op_does_not_crash(mock_client):
    from agentmail_toolkit.langchain import AgentMailToolkit

    mock_client.inboxes.delete.return_value = None
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["delete_inbox"]

    # Must not raise, regardless of what value it settles on for a None result.
    tool.invoke({"inbox_id": "in_1"})


def test_langchain_error_path_raises_tool_exception(mock_client):
    """F5: runnable() must raise ToolException (LangChain's own documented
    error-signaling exception), not return a fake-success payload."""
    from agentmail_toolkit.langchain import AgentMailToolkit

    mock_client.inboxes.get.side_effect = API_ERROR
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    with pytest.raises(LangchainToolException, match="Inbox not found"):
        tool.func(inbox_id="in_1")


def test_langchain_error_surfaces_as_error_tool_message(mock_client):
    """handle_tool_error=True (set post-construction — see langchain.py)
    converts the ToolException into a ToolMessage with status='error' when
    invoked the way agent executors do, distinguishable from a success."""
    from agentmail_toolkit.langchain import AgentMailToolkit

    mock_client.inboxes.get.side_effect = API_ERROR
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    message = tool.run(tool_input={"inbox_id": "in_1"}, tool_call_id="call_1")

    assert message.status == "error"
    assert "Inbox not found" in message.content


# --------------------------------------------------------------------------
# livekit adapter
# --------------------------------------------------------------------------


def _make_context():
    context = MagicMock()
    context.session.generate_reply = AsyncMock()
    return context


def test_livekit_success_returns_serialized_model(mock_client):
    from agentmail_toolkit.livekit import AgentMailToolkit

    inbox = make_inbox()
    mock_client.inboxes.get.return_value = inbox
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    result = asyncio.run(tool({"inbox_id": "in_1"}, _make_context()))

    assert result == inbox.model_dump_json()


def test_livekit_void_op_returns_ok_not_crash(mock_client):
    """F2: same None-return guard as openai.py."""
    from agentmail_toolkit.livekit import AgentMailToolkit

    mock_client.inboxes.delete.return_value = None
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["delete_inbox"]

    result = asyncio.run(tool({"inbox_id": "in_1"}, _make_context()))

    assert result == "OK"


def test_livekit_error_path_raises_tool_error(mock_client):
    """F5: livekit's own ToolError, not a bare str(e) dump of ApiError."""
    from agentmail_toolkit.livekit import AgentMailToolkit

    mock_client.inboxes.get.side_effect = API_ERROR
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    with pytest.raises(LivekitToolError, match="Inbox not found"):
        asyncio.run(tool({"inbox_id": "in_1"}, _make_context()))


def test_livekit_status_update_task_cancelled_on_error(mock_client, monkeypatch):
    """F8: the status-update task must be cancelled (or have already
    finished) on the error path too, not just on success — previously
    status_update_task.cancel() only ran after a successful call, leaking
    the task and its exception on every failure."""
    import agentmail_toolkit.livekit as livekit_module
    from agentmail_toolkit.livekit import AgentMailToolkit

    real_create_task = asyncio.create_task
    created_tasks = []

    def capturing_create_task(coro, *args, **kwargs):
        task = real_create_task(coro, *args, **kwargs)
        created_tasks.append(task)
        return task

    monkeypatch.setattr(livekit_module.asyncio, "create_task", capturing_create_task)

    mock_client.inboxes.get.side_effect = API_ERROR
    toolkit = AgentMailToolkit(client=mock_client)
    tool = toolkit._tools["get_inbox"]

    with pytest.raises(LivekitToolError):
        asyncio.run(tool({"inbox_id": "in_1"}, _make_context()))

    assert len(created_tasks) == 1
    # asyncio.run() cancels+awaits any leftover tasks before returning, so a
    # task that's still merely "pending" here would mean the finally block's
    # cancel() never ran — the exact bug F8 fixed.
    assert created_tasks[0].done()
