from typing import Optional
from pydantic import BaseModel, Field


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(description="The maximum number of items to return")
    last_key: Optional[str] = Field(description="The last key to use for pagination")


class GetInboxParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to get")
