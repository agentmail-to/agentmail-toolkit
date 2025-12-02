import json
from typing import Optional
from agents import FunctionTool, RunContextWrapper
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def on_invoke_tool(ctx: RunContextWrapper, input_str: str):
            try:
                result = tool.func(self.client, json.loads(input_str))
                return result.model_dump_json()
            except Exception as e:
                return str(e)

        params_json_schema = tool.params_schema.model_json_schema()
        params_json_schema["additionalProperties"] = False

        return FunctionTool(
            name=tool.name,
            description=tool.description,
            params_json_schema=params_json_schema,
            on_invoke_tool=on_invoke_tool,
        )
