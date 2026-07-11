import asyncio
import json
from typing import Optional
from agents import FunctionTool, RunContextWrapper
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool
from .util import api_error_message


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def on_invoke_tool(ctx: RunContextWrapper, input_str: str):
            try:
                result = await asyncio.to_thread(
                    tool.func, self.client, json.loads(input_str)
                )
            except Exception as e:
                # failure_error_function only applies to the @function_tool
                # decorator, not hand-built FunctionTool instances, so raise
                # and let the SDK surface this as a real tool failure instead
                # of returning the error as an ordinary "successful" string.
                raise RuntimeError(api_error_message(e)) from e

            return "OK" if result is None else result.model_dump_json()

        params_json_schema = tool.params_schema.model_json_schema()
        params_json_schema["additionalProperties"] = False

        return FunctionTool(
            name=tool.name,
            description=tool.description,
            params_json_schema=params_json_schema,
            on_invoke_tool=on_invoke_tool,
        )
