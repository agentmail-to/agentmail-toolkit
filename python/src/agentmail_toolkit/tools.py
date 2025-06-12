from typing import List, Type
from pydantic import BaseModel

from .schemas import (
    ListItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
    ListMessagesParams,
    GetMessageParams,
    SendMessageParams,
    ReplyToMessageParams,
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
        description="Create inbox. Use default username, domain, and display name unless otherwise specified.",
        params_schema=CreateInboxParams,
    ),
    Tool(
        name="list_threads",
        method_name="inboxes.threads.list",
        description="List threads in inbox",
        params_schema=ListThreadsParams,
    ),
    Tool(
        name="get_thread",
        method_name="inboxes.threads.get",
        description="Get thread in inbox",
        params_schema=GetThreadParams,
    ),
    Tool(
        name="list_messages",
        method_name="inboxes.messages.list",
        description="List messages in inbox",
        params_schema=ListMessagesParams,
    ),
    Tool(
        name="get_message",
        method_name="inboxes.messages.get",
        description="Get message in inbox",
        params_schema=GetMessageParams,
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
]
