from typing import Optional
from livekit.agents import FunctionTool, RunContext, ToolError, function_tool
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def f(raw_arguments: dict[str, object], context: RunContext):
            try:
                handle = context.session.generate_reply(
                    instructions=f"Inform the user that you performing the following operation: {tool.description}"
                )

                result = self.call_method(
                    tool.method_name, raw_arguments
                ).model_dump_json()

                await handle

                return result
            except Exception as e:
                raise ToolError(str(e))

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
