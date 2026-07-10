from typing import Optional
from langchain.tools import BaseTool, ToolException, tool as langchain_tool
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool
from .util import api_error_message


class AgentMailToolkit(Toolkit[BaseTool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: Tool):
        def runnable(**kwargs):
            try:
                return tool.func(self.client, kwargs)
            except Exception as e:
                raise ToolException(api_error_message(e)) from e

        return langchain_tool(
            name_or_callable=tool.name,
            description=tool.description,
            args_schema=tool.params_schema,
            runnable=runnable,
            handle_tool_error=True,
        )
