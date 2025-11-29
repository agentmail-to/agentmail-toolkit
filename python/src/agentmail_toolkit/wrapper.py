from typing import Optional, Any
from abc import ABC
from pydantic import BaseModel
from agentmail import AgentMail


class Wrapper(ABC):
    _client: AgentMail = None

    def __init__(self, client: Optional[AgentMail] = None):
        self._client = client or AgentMail()

    def call_method(self, method_name: str, args: dict[str, Any]) -> BaseModel:
        if hasattr(self, method_name):
            return getattr(self, method_name)(**args)
        else:
            method = self._client
            for part in method_name.split("."):
                method = getattr(method, part)

            return method(**args)
