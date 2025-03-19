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
    GetAttachmentParams,
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
        description="List all inboxes",
        params_schema=ListItemsParams,
    ),
    Tool(
        name="get_inbox",
        method_name="inboxes.get",
        description="Get inbox by ID",
        params_schema=GetInboxParams,
    ),
    Tool(
        name="create_inbox",
        method_name="inboxes.create",
        description="Create a new inbox. Use default username, domain, and display name unless otherwise specified.",
        params_schema=CreateInboxParams,
    ),
    Tool(
        name="list_threads",
        method_name="threads.list",
        description="List threads by inbox ID",
        params_schema=ListThreadsParams,
    ),
    Tool(
        name="get_thread",
        method_name="threads.get",
        description="Get thread by ID",
        params_schema=GetThreadParams,
    ),
    Tool(
        name="list_messages",
        method_name="messages.list",
        description="List messages by thread ID",
        params_schema=ListMessagesParams,
    ),
    Tool(
        name="get_message",
        method_name="messages.get",
        description="Get message by ID",
        params_schema=GetMessageParams,
    ),
    Tool(
        name="get_attachment",
        method_name="attachments.get",
        description="Get attachment by ID",
        params_schema=GetAttachmentParams,
    ),
    Tool(
        name="send_message",
        method_name="messages.send",
        description="Send a message",
        params_schema=SendMessageParams,
    ),
    Tool(
        name="reply_to_message",
        method_name="messages.reply",
        description="Reply to a message",
        params_schema=ReplyToMessageParams,
    ),
]
