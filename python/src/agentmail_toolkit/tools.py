from typing import List, Type
from pydantic import BaseModel

from .schemas import ListItemsParams


class Tool(BaseModel):
    name: str
    method_name: str
    description: str
    params_schema: Type[BaseModel]


tools: List[Tool] = [
    Tool(
        name="list_inboxes",
        method_name="inboxes.list",
        description="List all inboxes",
        params_schema=ListItemsParams,
    )
]
