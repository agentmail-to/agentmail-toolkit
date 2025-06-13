from typing import TypeVar, Generic, Optional, Dict, List
from abc import ABC, abstractmethod
from agentmail import AgentMail

from .wrapper import Wrapper
from .tools import Tool, tools


T = TypeVar("T")


class Toolkit(Wrapper, Generic[T], ABC):
    _tools: Dict[str, T] = None

    def __init__(self, client: Optional[AgentMail] = None):
        super().__init__(client)

        self._tools = {tool.name: self._build_tool(tool) for tool in tools}

    @abstractmethod
    def _build_tool(self, tool: Tool) -> T:
        pass

    def get_tools(self, names: Optional[List[str]] = None):
        if not names:
            return list(self._tools.values())

        return [self._tools[name] for name in names if name in self._tools]
