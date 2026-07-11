from typing import Optional
from livekit.agents import FunctionTool, RunContext, ToolError, function_tool
from agentmail import AgentMail
import asyncio

from .toolkit import Toolkit
from .tools import Tool
from .util import api_error_message


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def f(raw_arguments: dict[str, object], context: RunContext):
            async def _status_update():
                await context.session.generate_reply(
                    instructions=f"Inform the user that you are doing the following: {tool.description}"
                )

            status_update_task = asyncio.create_task(_status_update())
            try:
                result = await asyncio.to_thread(tool.func, self.client, raw_arguments)
                return "OK" if result is None else result.model_dump_json()
            except Exception as e:
                raise ToolError(api_error_message(e))
            finally:
                status_update_task.cancel()

        return function_tool(
            f=f,
            name=tool.name,
            description=tool.description,
            raw_schema={
                "type": "function",
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.params_schema.model_json_schema(),
            },
        )
