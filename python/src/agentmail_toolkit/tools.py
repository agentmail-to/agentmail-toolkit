from typing import List, Type
from pydantic import BaseModel

from .schemas import (
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
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
    schema: Type[BaseModel]


tools: List[Tool] = [
    Tool(
        name="list_inboxes",
        method_name="inboxes.list",
        description="List inboxes",
        schema=ListItemsParams,
    ),
    Tool(
        name="get_inbox",
        method_name="inboxes.get",
        description="Get inbox",
        schema=GetInboxParams,
    ),
    Tool(
        name="create_inbox",
        method_name="inboxes.create",
        description="Create inbox",
        schema=CreateInboxParams,
    ),
    Tool(
        name="list_threads",
        method_name="inboxes.threads.list",
        description="List threads in inbox",
        schema=ListThreadsParams,
    ),
    Tool(
        name="list_all_threads",
        method_name="threads.list",
        description="List threads in all inboxes",
        schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_thread",
        method_name="threads.get",
        description="Get thread",
        schema=GetThreadParams,
    ),
    Tool(
        name="send_message",
        method_name="inboxes.messages.send",
        description="Send message",
        schema=SendMessageParams,
    ),
    Tool(
        name="reply_to_message",
        method_name="inboxes.messages.reply",
        description="Reply to message",
        schema=ReplyToMessageParams,
    ),
    Tool(
        name="update_message",
        method_name="inboxes.messages.update",
        description="Update message",
        schema=UpdateMessageParams,
    ),
    Tool(
        name="list_drafts",
        method_name="inboxes.drafts.list",
        description="List drafts in inbox",
        schema=ListDraftsParams,
    ),
    Tool(
        name="list_all_drafts",
        method_name="drafts.list",
        description="List drafts in all inboxes",
        schema=ListInboxItemsParams,
    ),
    Tool(
        name="get_draft",
        method_name="drafts.get",
        description="Get draft",
        schema=GetDraftParams,
    ),
    Tool(
        name="create_draft",
        method_name="inboxes.drafts.create",
        description="Create draft",
        schema=CreateDraftParams,
    ),
    Tool(
        name="send_draft",
        method_name="inboxes.drafts.send",
        description="Send draft",
        schema=SendDraftParams,
    ),
]
