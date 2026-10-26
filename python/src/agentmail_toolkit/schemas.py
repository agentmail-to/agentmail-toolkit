from typing import Annotated, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

# Where each ID comes from, so an agent can fill it without guessing. Message IDs are RFC 5322
# Message-IDs and keep their angle brackets; get_attachment reads the thread's attachment list,
# so an attachment ID is taken from there.
InboxIdField = Annotated[str, Field(description="Inbox ID: the inbox's email address, from list_inboxes")]
ThreadIdField = Annotated[str, Field(description="Thread ID, from list_threads or a message's thread_id")]
MessageIdField = Annotated[str, Field(description="Message ID with its angle brackets, from get_thread")]
AttachmentIdField = Annotated[
    str, Field(description="Attachment ID, from a thread's attachments in list_threads or get_thread")
]

# The SDK sends a datetime with its own offset (or the runtime's, if it has none), and the API
# accepts only UTC ending in Z, so ask for UTC.
UTC_EXAMPLE = "ISO 8601 UTC ending in Z, e.g. 2026-04-01T09:00:00Z"


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(default=10, description="Number of items per page")
    page_token: Optional[str] = Field(
        default=None, description="next_page_token from the previous page's result; omit for the first page"
    )


class GetInboxParams(BaseModel):
    inbox_id: InboxIdField


class CreateInboxParams(BaseModel):
    username: Optional[str] = Field(
        default=None, description="Part of the address before the @; a random one is generated when omitted"
    )
    domain: Optional[str] = Field(
        default=None, description="Domain of the address, agentmail.to when omitted; a custom domain must be verified first"
    )
    display_name: Optional[str] = Field(
        default=None, description='Sender name recipients see; "AgentMail" when omitted, and an empty string sends none'
    )


class ListInboxItemsParams(ListItemsParams):
    inbox_id: InboxIdField
    labels: Optional[List[str]] = Field(
        default=None, description="Only items carrying all of these labels, such as unread or your own"
    )
    before: Optional[datetime] = Field(default=None, description=f"Only items before this time, as {UTC_EXAMPLE}")
    after: Optional[datetime] = Field(default=None, description=f"Only items at or after this time, as {UTC_EXAMPLE}")
    ascending: Optional[bool] = Field(default=None, description="Sort by oldest first instead of most recent first")
    include_spam: Optional[bool] = Field(
        default=None, description="Also return items labeled spam, which are left out when omitted"
    )
    include_blocked: Optional[bool] = Field(
        default=None,
        description="Also return mail labeled blocked (its sender is on a block list), which is left out when omitted",
    )
    include_unauthenticated: Optional[bool] = Field(
        default=None,
        description="Also return mail labeled unauthenticated (no sender authentication passed), which is left out "
        "when omitted; needs an API key with label_unauthenticated_read, or it stays left out without an error",
    )
    include_trash: Optional[bool] = Field(
        default=None, description="Also return items labeled trash, which are left out when omitted"
    )


class GetThreadParams(BaseModel):
    inbox_id: InboxIdField
    thread_id: ThreadIdField


class GetAttachmentParams(BaseModel):
    inbox_id: InboxIdField
    thread_id: ThreadIdField
    attachment_id: AttachmentIdField


class Attachment(BaseModel):
    filename: Optional[str] = Field(default=None, description="File name recipients see, e.g. report.pdf")
    content_id: Optional[str] = Field(
        default=None, description="ID the HTML body references as cid:<content_id> to show it inline"
    )
    content: Optional[str] = Field(
        default=None,
        description="Base64-encoded file content: standard, padded, no data: prefix. Exactly one of content or url must be provided",
    )
    url: Optional[str] = Field(
        default=None,
        description="Public http(s) URL AgentMail fetches the file from. Exactly one of content or url must be provided",
    )


class BaseMessageParams(BaseModel):
    inbox_id: InboxIdField
    text: Optional[str] = Field(
        default=None,
        description="Plain-text body; include it even with html, since no text version is generated from html",
    )
    html: Optional[str] = Field(
        default=None, description="HTML body for formatted mail; inline images use cid:<content_id>"
    )
    labels: Optional[List[str]] = Field(
        default=None, description="Your own labels for the message; AgentMail sets system labels such as sent"
    )
    attachments: Optional[List[Attachment]] = Field(
        default=None, description="Attachments. Each item must specify exactly one of content (base64) or url"
    )


class SendMessageParams(BaseMessageParams):
    to: List[str] = Field(
        description='Recipient addresses, each a bare address or "Name <address>"; at least one of to, cc or bcc is required'
    )
    cc: Optional[List[str]] = Field(default=None, description="Copied addresses, visible to every recipient")
    bcc: Optional[List[str]] = Field(default=None, description="Blind-copied addresses, hidden from the other recipients")
    subject: Optional[str] = Field(default=None, description="Subject line recipients see")


class ReplyToMessageParams(BaseMessageParams):
    message_id: MessageIdField
    reply_all: Optional[bool] = Field(
        default=None,
        description="Also reply to all original recipients; when omitted the reply goes to the original's Reply-To, else its sender",
    )


class ForwardMessageParams(SendMessageParams):
    message_id: str = Field(
        description="ID of the message to forward, with its angle brackets; its body and all attachments are included"
    )
    subject: Optional[str] = Field(
        default=None, description='Subject line; "Fwd: " plus the original subject when omitted'
    )


class UpdateMessageParams(BaseModel):
    inbox_id: InboxIdField
    message_id: MessageIdField
    add_labels: Optional[List[str]] = Field(
        default=None, description="Labels to add to the message, e.g. unread or your own"
    )
    remove_labels: Optional[List[str]] = Field(
        default=None, description="Labels to remove from the message, e.g. unread to mark it read"
    )


class AgentAttachHumanParams(BaseModel):
    human_email: str = Field(
        description="Email address of the human you work for. They are emailed a 6-digit verification code"
    )


class AgentVerifyParams(BaseModel):
    otp_code: str = Field(description="6-digit verification code emailed to the human attached to the organization")
