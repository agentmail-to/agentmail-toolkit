from typing import Any, Callable
from pydantic import BaseModel
from agentmail import AgentMail


type Kwargs = dict[str, Any]


class ToolError(BaseModel):
    error: str


def safe_func(
    func: Callable[[AgentMail, Kwargs], Any],
    client: AgentMail,
    kwargs: Kwargs,
):
    try:
        return func(client, kwargs)
    except Exception as e:
        return ToolError(error=str(e))
