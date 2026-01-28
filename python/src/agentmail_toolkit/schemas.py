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
    page_token: Optional[str] = Field(description="Pagination page token")


class GetInboxParams(BaseModel):
    inbox_id: InboxIdField


class CreateInboxParams(BaseModel):
    username: Optional[str] = Field(description="Username")
    domain: Optional[str] = Field(description="Domain")
    display_name: Optional[str] = Field(description="Display name")


class ListInboxItemsParams(ListItemsParams):
    inbox_id: InboxIdField
    labels: Optional[List[str]] = Field(description="Filter items with labels")
    before: Optional[datetime] = Field(description="Filter items before datetime")
    after: Optional[datetime] = Field(description="Filter items after datetime")


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
    content: Optional[str] = Field(default=None, description="Base64 encoded content")
    url: Optional[str] = Field(default=None, description="URL")


class BaseMessageParams(BaseModel):
    inbox_id: InboxIdField
    text: Optional[str] = Field(description="Plain text body")
    html: Optional[str] = Field(description="HTML body")
    labels: Optional[List[str]] = Field(description="Labels")
    attachments: Optional[List[Attachment]] = Field(default=None, description="Attachments")


class SendMessageParams(BaseMessageParams):
    to: List[str] = Field(description="Recipients")
    cc: Optional[List[str]] = Field(description="CC recipients")
    bcc: Optional[List[str]] = Field(description="BCC recipients")
    subject: Optional[str] = Field(description="Subject")


class ReplyToMessageParams(BaseMessageParams):
    message_id: MessageIdField
    reply_all: Optional[bool] = Field(description="Reply to all recipients")


class ForwardMessageParams(SendMessageParams):
    message_id: MessageIdField


class UpdateMessageParams(BaseModel):
    inbox_id: InboxIdField
    message_id: MessageIdField
    add_labels: Optional[List[str]] = Field(description="Labels to add")
    remove_labels: Optional[List[str]] = Field(description="Labels to remove")
