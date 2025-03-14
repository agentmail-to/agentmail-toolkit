from typing import List, Type
from pydantic import BaseModel

from .schemas import ListItemsParams, GetInboxParams


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
    ),
    Tool(
        name="get_inbox",
        method_name="inboxes.get",
        description="Get inbox by ID",
        params_schema=GetInboxParams,
    ),
]
