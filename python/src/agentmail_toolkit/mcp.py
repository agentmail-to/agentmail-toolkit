from mcp.server.fastmcp.tools.base import Tool as McpTool
from mcp.server.fastmcp.utilities.func_metadata import FuncMetadata, ArgModelBase
from pydantic import create_model
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

        params = {
            name: (field.annotation, field)
            for name, field in tool.params_schema.model_fields.items()
        }

        arg_model = create_model(
            f"{tool.name}Arguments",
            **params,
            __base__=ArgModelBase,
        )

        return McpTool(
            name=tool.name,
            description=tool.description,
            parameters=tool.params_schema.model_json_schema(),
            fn_metadata=FuncMetadata(arg_model=arg_model),
            is_async=False,
            fn=fn,
        )
