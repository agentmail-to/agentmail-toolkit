from typing import List, Type, Callable
from pydantic import BaseModel
from agentmail import AgentMail

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
    ForwardMessageParams,
)
from .functions import (
    Kwargs,
    list_inboxes,
    get_inbox,
    create_inbox,
    delete_inbox,
    list_threads,
    get_thread,
    get_attachment,
    send_message,
    reply_to_message,
    update_message,
    forward_message,
)


class Tool(BaseModel):
    name: str
    description: str
    params_schema: Type[BaseModel]
    func: Callable[[AgentMail, Kwargs], BaseModel]


tools: List[Tool] = [
    Tool(
        name="list_inboxes",
        description="List inboxes",
        params_schema=ListItemsParams,
        func=list_inboxes,
    ),
    Tool(
        name="get_inbox",
        description="Get inbox",
        params_schema=GetInboxParams,
        func=get_inbox,
    ),
    Tool(
        name="create_inbox",
        description="Create inbox",
        params_schema=CreateInboxParams,
        func=create_inbox,
    ),
    Tool(
        name="delete_inbox",
        description="Delete inbox",
        params_schema=GetInboxParams,
        func=delete_inbox,
    ),
    Tool(
        name="list_threads",
        description="List threads in inbox",
        params_schema=ListInboxItemsParams,
        func=list_threads,
    ),
    Tool(
        name="get_thread",
        description="Get thread",
        params_schema=GetThreadParams,
        func=get_thread,
    ),
    Tool(
        name="get_attachment",
        description="Get attachment",
        params_schema=GetAttachmentParams,
        func=get_attachment,
    ),
    Tool(
        name="send_message",
        description="Send message",
        params_schema=SendMessageParams,
        func=send_message,
    ),
    Tool(
        name="reply_to_message",
        description="Reply to message",
        params_schema=ReplyToMessageParams,
        func=reply_to_message,
    ),
    Tool(
        name="forward_message",
        description="Forward message",
        params_schema=ForwardMessageParams,
        func=forward_message,
    ),
    Tool(
        name="update_message",
        description="Update message",
        params_schema=UpdateMessageParams,
        func=update_message,
    ),
]
