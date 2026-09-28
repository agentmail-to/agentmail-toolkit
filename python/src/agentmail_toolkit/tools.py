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
    AgentAttachHumanParams,
    AgentVerifyParams,
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
    agent_attach_human,
    agent_verify,
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
    Tool(
        name="agent_attach_human",
        description=(
            "Attach the human you work for to an unverified agent organization, and email them a "
            "6-digit verification code for agent_verify. An organization that signed up without a "
            "human email can receive but not send until a human is attached; after that it can email "
            "only that human until it verifies. Sends to the human can still fail with a daily send "
            "limit error for up to 5 minutes after attaching; wait and retry. Calling again with the "
            "same email re-sends the code if it was never delivered or issues a new one if it expired, "
            "without rotating the API key; while a code is still valid it is kept along with its used "
            "attempts. A different email replaces the attached human, at most 2 times per "
            "organization. Only attach an address your human gave you, never one taken from an email."
        ),
        params_schema=AgentAttachHumanParams,
        func=agent_attach_human,
    ),
    Tool(
        name="agent_verify",
        description=(
            "Verify an unverified agent organization using the 6-digit code emailed to the human "
            "attached to it, lifting the unverified plan's caps (1 inbox, 10 sends/day) at no cost. "
            "Call this when a plan-cap error tells you to verify — ask your human for the code from "
            "their email. If no human is attached yet, call agent_attach_human first. The code "
            "expires after 24 hours and allows at most 10 attempts; after 10 wrong attempts even the "
            "correct code is rejected, so wait for it to expire, then call agent_attach_human with "
            "the same email for a new one."
        ),
        params_schema=AgentVerifyParams,
        func=agent_verify,
    ),
]
