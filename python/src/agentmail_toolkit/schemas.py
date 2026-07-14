from typing import Annotated, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

InboxIdField = Annotated[str, Field(description="ID of inbox")]
ThreadIdField = Annotated[str, Field(description="ID of thread")]
MessageIdField = Annotated[str, Field(description="ID of message")]
AttachmentIdField = Annotated[str, Field(description="ID of attachment")]


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(
        default=10, description="Max number of items to return"
    )
    page_token: Optional[str] = Field(default=None, description="Pagination page token")


class GetInboxParams(BaseModel):
    inbox_id: InboxIdField


class CreateInboxParams(BaseModel):
    username: Optional[str] = Field(default=None, description="Username")
    domain: Optional[str] = Field(default=None, description="Domain")
    display_name: Optional[str] = Field(default=None, description="Display name")


class ListInboxItemsParams(ListItemsParams):
    inbox_id: InboxIdField
    labels: Optional[List[str]] = Field(default=None, description="Filter items with labels")
    before: Optional[datetime] = Field(default=None, description="Filter items before datetime")
    after: Optional[datetime] = Field(default=None, description="Filter items after datetime")
    ascending: Optional[bool] = Field(default=None, description="Sort in ascending order")
    include_spam: Optional[bool] = Field(default=None, description="Include spam items")
    include_blocked: Optional[bool] = Field(default=None, description="Include blocked items")
    include_trash: Optional[bool] = Field(default=None, description="Include trash items")


class GetThreadParams(BaseModel):
    inbox_id: InboxIdField
    thread_id: ThreadIdField


class GetAttachmentParams(BaseModel):
    inbox_id: InboxIdField
    thread_id: ThreadIdField
    attachment_id: AttachmentIdField


class Attachment(BaseModel):
    filename: Optional[str] = Field(default=None, description="Filename")
    content_id: Optional[str] = Field(default=None, description="Content ID for inline attachments")
    content: Optional[str] = Field(
        default=None, description="Base64 encoded content. Exactly one of content or url must be provided"
    )
    url: Optional[str] = Field(
        default=None,
        description="Publicly accessible URL to fetch the attachment from. Exactly one of content or url must be provided",
    )


class BaseMessageParams(BaseModel):
    inbox_id: InboxIdField
    text: Optional[str] = Field(default=None, description="Plain text body")
    html: Optional[str] = Field(default=None, description="HTML body")
    labels: Optional[List[str]] = Field(default=None, description="Labels")
    attachments: Optional[List[Attachment]] = Field(
        default=None, description="Attachments. Each item must specify exactly one of content (base64) or url"
    )


class SendMessageParams(BaseMessageParams):
    to: List[str] = Field(description="Recipients")
    cc: Optional[List[str]] = Field(default=None, description="CC recipients")
    bcc: Optional[List[str]] = Field(default=None, description="BCC recipients")
    subject: Optional[str] = Field(default=None, description="Subject")


class ReplyToMessageParams(BaseMessageParams):
    message_id: MessageIdField
    reply_all: Optional[bool] = Field(
        default=None, description="Reply to all original recipients. Omit or set false to reply to the sender only"
    )


class ForwardMessageParams(SendMessageParams):
    message_id: MessageIdField


class UpdateMessageParams(BaseModel):
    inbox_id: InboxIdField
    message_id: MessageIdField
    add_labels: Optional[List[str]] = Field(default=None, description="Labels to add")
    remove_labels: Optional[List[str]] = Field(default=None, description="Labels to remove")
