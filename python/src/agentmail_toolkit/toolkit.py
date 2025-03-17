from typing import TypeVar, Generic, List, Optional
from abc import ABC, abstractmethod
from pydantic import BaseModel
from agentmail import AgentMail

from .tools import Tool, tools


T = TypeVar("T")


class Toolkit(Generic[T], ABC):
    _client: AgentMail = None
    _tools: List[T] = None

    def __init__(self, client: Optional[AgentMail] = None):
        if client:
            self._client = client
        else:
            self._client = AgentMail()

        self._tools = [self._build_tool(tool) for tool in tools]

    @abstractmethod
    def _build_tool(self, tool: Tool) -> T:
        pass

    def call_method(self, method_name: str, args: BaseModel) -> BaseModel:
        method = self._client
        for part in method_name.split("."):
            method = getattr(method, part)

        return method(**args.model_dump())

    def get_tools(self) -> List[T]:
        return self._tools
