from typing import Optional
from livekit.agents import FunctionTool, RunContext, function_tool
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def f(raw_arguments: dict[str, object], context: RunContext):
            return tool.fn(**raw_arguments).json()

        return function_tool(
            f=f,
            name=tool.name,
            description=tool.description,
            raw_schema={
                "type": "function",
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.schema.model_json_schema(),
            },
        )
