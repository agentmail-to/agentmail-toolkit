from typing import Optional
from agentmail import AgentMail
from agents import FunctionTool, RunContextWrapper

from .toolkit import Toolkit
from .tools import Tool


class AgentMailToolkit(Toolkit[FunctionTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        async def on_invoke_tool(ctx: RunContextWrapper, input_str: str):
            return self.call_method(
                tool.method_name,
                tool.params_schema.model_validate_json(input_str),
            ).model_dump_json()

        params_json_schema = tool.params_schema.model_json_schema()
        params_json_schema["additionalProperties"] = False

        return FunctionTool(
            name=tool.name,
            description=tool.description,
            params_json_schema=params_json_schema,
            on_invoke_tool=on_invoke_tool,
        )
