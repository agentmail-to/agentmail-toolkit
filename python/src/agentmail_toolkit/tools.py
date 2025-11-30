from typing import List, Type
from pydantic import BaseModel

from .schemas import (
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    GetThreadParams,
    GetAttachmentParams,
    SendMessageParams,
    ReplyToMessageParams,
    UpdateMessageParams,
)


class Tool(BaseModel):
    name: str
    method_name: str
    description: str
    params_schema: Type[BaseModel]


tools: List[Tool] = [
    Tool(
        name="list_inboxes",
        method_name="inboxes.list",
        description="List inboxes",
        params_schema=ListItemsParams,
    ),
    Tool(
        name="get_inbox",
        method_name="inboxes.get",
        description="Get inbox",
        params_schema=GetInboxParams,
    ),
    Tool(
        name="create_inbox",
        method_name="inboxes.create",
        description="Create inbox",
        params_schema=CreateInboxParams,
    ),
    Tool(
        name="delete_inbox",
        method_name="inboxes.delete",
        description="Delete inbox",
        params_schema=GetInboxParams,
    ),
    Tool(
        name="list_threads",
        method_name="inboxes.threads.list",
        description="List threads in inbox",
        params_schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_thread",
        method_name="inboxes.threads.get",
        description="Get thread",
        params_schema=GetThreadParams,
    ),
    Tool(
        name="get_attachment",
        method_name="get_attachment",
        description="Get attachment",
        params_schema=GetAttachmentParams,
    ),
    Tool(
        name="send_message",
        method_name="inboxes.messages.send",
        description="Send message",
        params_schema=SendMessageParams,
    ),
    Tool(
        name="reply_to_message",
        method_name="inboxes.messages.reply",
        description="Reply to message",
        params_schema=ReplyToMessageParams,
    ),
    Tool(
        name="update_message",
        method_name="inboxes.messages.update",
        description="Update message",
        params_schema=UpdateMessageParams,
    ),
]
