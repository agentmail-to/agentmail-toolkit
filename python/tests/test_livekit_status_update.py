"""Tests that the LiveKit tool's status-update task actually runs.

Before the fix, `tool.func` was called synchronously inside the async `f`
handler.  Because a synchronous (blocking) call never yields to the event
loop, the `_status_update` task created just before it could never be
scheduled — and was cancelled before it had a chance to run.

After the fix, `tool.func` is off-loaded to a thread via `asyncio.to_thread`,
which yields control back to the event loop and lets `_status_update` run.
"""

import asyncio
import threading
import unittest
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Minimal stubs for livekit.agents and agentmail so the import works in
# environments that don't have those packages installed.
# ---------------------------------------------------------------------------

import sys
import types

# Stub heavy optional dependencies before any agentmail_toolkit import
for _mod in [
    "livekit",
    "livekit.agents",
    "pymupdf",
    "filetype",
    "docx",
    "langchain",
    "langchain.tools",
    "agents",
]:
    if _mod not in sys.modules:
        sys.modules[_mod] = types.ModuleType(_mod)

livekit_agents = sys.modules["livekit.agents"]
livekit_agents.FunctionTool = object  # type: ignore[attr-defined]
livekit_agents.RunContext = object  # type: ignore[attr-defined]
livekit_agents.ToolError = Exception  # type: ignore[attr-defined]


def _noop_function_tool(**kwargs):
    """Stub for livekit.agents.function_tool — just return a sentinel."""
    func = kwargs.get("f")

    class _FakeFunctionTool:
        def __init__(self):
            self._f = func

        async def __call__(self, *args, **kw):
            return await self._f(*args, **kw)

    return _FakeFunctionTool()


livekit_agents.function_tool = _noop_function_tool  # type: ignore[attr-defined]

if "agentmail" not in sys.modules:
    sys.modules["agentmail"] = types.ModuleType("agentmail")
    sys.modules["agentmail"].AgentMail = MagicMock  # type: ignore[attr-defined]

# Patch the toolkit base so we don't try to build all tools at init time.
from agentmail_toolkit.tools import Tool  # noqa: E402
from agentmail_toolkit.livekit import AgentMailToolkit  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_tool(func) -> Tool:
    """Build a minimal Tool wrapping the given callable."""
    from pydantic import BaseModel

    class _Params(BaseModel):
        pass

    return Tool(
        name="test_tool",
        description="test description",
        params_schema=_Params,
        func=func,
    )


def _make_context(reply_mock: AsyncMock) -> MagicMock:
    ctx = MagicMock()
    ctx.session.generate_reply = reply_mock
    return ctx


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLiveKitStatusUpdateRuns(unittest.IsolatedAsyncioTestCase):
    """Verify that _status_update is given a chance to run during tool execution."""

    async def test_status_update_fires_during_blocking_tool(self) -> None:
        """_status_update must run before tool.func returns.

        If tool.func blocks the event loop (old code), _status_update is
        cancelled before it can be scheduled and `generate_reply` is never
        called.  With asyncio.to_thread, the task runs concurrently.
        """
        reply_called = asyncio.Event()

        async def mock_generate_reply(**kwargs):
            reply_called.set()

        reply_mock = AsyncMock(side_effect=mock_generate_reply)
        ctx = _make_context(reply_mock)

        # Synchronous tool that deliberately yields by sleeping in a thread —
        # we wait until status_update has a chance to fire, then proceed.
        gate = threading.Event()

        def slow_func(client, kwargs):
            # Block just long enough for the event loop to schedule tasks.
            gate.wait(timeout=2)
            result = MagicMock()
            result.model_dump_json.return_value = '{"ok": true}'
            return result

        tool = _make_tool(slow_func)

        toolkit = object.__new__(AgentMailToolkit)
        toolkit.client = MagicMock()
        built = toolkit._build_tool(tool)

        # Schedule the tool call.  We allow _status_update to run by releasing
        # the gate only after the event loop gets control back.
        async def run():
            task = asyncio.create_task(built._f({}, ctx))
            # Let the event loop tick once so _status_update can start.
            await asyncio.sleep(0)
            gate.set()  # Release slow_func
            return await task

        await run()
        self.assertTrue(
            reply_called.is_set(),
            "generate_reply was never called — status update did not run",
        )

    async def test_tool_result_returned_correctly(self) -> None:
        """The tool result must be the JSON-serialised return value of func."""
        reply_mock = AsyncMock()
        ctx = _make_context(reply_mock)

        expected = '{"message": "hello"}'

        def func(client, kwargs):
            result = MagicMock()
            result.model_dump_json.return_value = expected
            return result

        tool = _make_tool(func)
        toolkit = object.__new__(AgentMailToolkit)
        toolkit.client = MagicMock()
        built = toolkit._build_tool(tool)

        result = await built._f({}, ctx)
        self.assertEqual(result, expected)


if __name__ == "__main__":
    unittest.main()
