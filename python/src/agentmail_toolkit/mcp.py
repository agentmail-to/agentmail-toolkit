from mcp.server.fastmcp.tools.base import Tool as McpTool
from mcp.server.fastmcp.utilities.func_metadata import FuncMetadata
from typing import Optional
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool


class AgentMailToolkit(Toolkit[McpTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        def fn(**kwargs):
            return self.call_method(tool.method_name, tool.params_schema(**kwargs))

        fn.__annotations__ = tool.params_schema.model_json_schema()

        return McpTool(
            name=tool.name,
            description=tool.description,
            parameters=tool.params_schema.model_json_schema(),
            fn_metadata=FuncMetadata(
                arg_model=tool.params_schema,
            ),
            is_async=False,
            fn=fn,
        )
