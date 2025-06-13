from typing import List, Type
from pydantic import BaseModel

from .schemas import (
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
    ListMessagesParams,
    GetMessageParams,
    SendMessageParams,
    ReplyToMessageParams,
    UpdateMessageParams,
    ListDraftsParams,
    GetDraftParams,
    CreateDraftParams,
    SendDraftParams,
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
        name="list_threads",
        method_name="inboxes.threads.list",
        description="List threads in inbox",
        params_schema=ListThreadsParams,
    ),
    Tool(
        name="list_all_threads",
        method_name="threads.list",
        description="List threads in all inboxes",
        params_schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_thread",
        method_name="threads.get",
        description="Get thread",
        params_schema=GetThreadParams,
    ),
    Tool(
        name="list_messages",
        method_name="inboxes.messages.list",
        description="List messages in inbox",
        params_schema=ListMessagesParams,
    ),
    Tool(
        name="list_all_messages",
        method_name="messages.list",
        description="List messages in all inboxes",
        params_schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_message",
        method_name="messages.get",
        description="Get message",
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
    Tool(
        name="update_message",
        method_name="inboxes.messages.update",
        description="Update message",
        params_schema=UpdateMessageParams,
    ),
    Tool(
        name="list_drafts",
        method_name="inboxes.drafts.list",
        description="List drafts in inbox",
        params_schema=ListDraftsParams,
    ),
    Tool(
        name="list_all_drafts",
        method_name="drafts.list",
        description="List drafts in all inboxes",
        params_schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_draft",
        method_name="drafts.get",
        description="Get draft",
        params_schema=GetDraftParams,
    ),
    Tool(
        name="create_draft",
        method_name="inboxes.drafts.create",
        description="Create draft",
        params_schema=CreateDraftParams,
    ),
    Tool(
        name="send_draft",
        method_name="inboxes.drafts.send",
        description="Send draft",
        params_schema=SendDraftParams,
    ),
]
