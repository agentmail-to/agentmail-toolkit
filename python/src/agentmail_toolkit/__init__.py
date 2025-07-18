from typing import Optional, Type, Callable
from pydantic import BaseModel
from agentmail import AgentMail

from .toolkit import Toolkit
from .tools import Tool as BaseTool


class Tool(BaseModel):
    name: str
    description: str
    schema: Type[BaseModel]
    fn: Callable


class AgentMailToolkit(Toolkit[Tool]):
    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

    def _build_tool(self, tool: BaseTool):
        def fn(**kwargs):
            return self.call_method(tool.method_name, tool.schema(**kwargs))

        return Tool(
            name=tool.name,
            description=tool.description,
            schema=tool.schema,
            fn=fn,
        )
