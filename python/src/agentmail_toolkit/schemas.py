from typing import Optional, List
from pydantic import BaseModel, Field


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(description="Max number of items to return")
    page_token: Optional[str] = Field(description="Page token for pagination")


class ListInboxItemsParams(ListItemsParams):
    labels: Optional[List[str]] = Field(description="Labels to filter items by")
    ascending: Optional[bool] = Field(description="Sort items in ascending order")


class GetInboxParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to get")


class CreateInboxParams(BaseModel):
    username: Optional[str] = Field(description="Username of inbox to create")
    domain: Optional[str] = Field(description="Domain of inbox to create")
    display_name: Optional[str] = Field(description="Display name of inbox to create")


class ListThreadsParams(ListInboxItemsParams):
    inbox_id: str = Field(description="ID of inbox to list threads from")


class GetThreadParams(BaseModel):
    thread_id: str = Field(description="ID of thread to get")


class GetAttachmentParams(BaseModel):
    thread_id: str = Field(description="ID of thread to get attachment from")
    attachment_id: str = Field(description="ID of attachment to get")


class SendMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to send message from")
    to: List[str] = Field(description="Recipients of message")
    cc: Optional[List[str]] = Field(description="CC recipients of message")
    bcc: Optional[List[str]] = Field(description="BCC recipients of message")
    subject: Optional[str] = Field(description="Subject of message")
    text: Optional[str] = Field(description="Plain text body of message")
    html: Optional[str] = Field(description="HTML body of message")
    labels: Optional[List[str]] = Field(description="Labels to add to message")


class ReplyToMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to reply to message from")
    message_id: str = Field(description="ID of message to reply to")
    text: Optional[str] = Field(description="Plain text body of reply")
    html: Optional[str] = Field(description="HTML body of reply")
    labels: Optional[List[str]] = Field(description="Labels to add to reply")


class UpdateMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to update message from")
    message_id: str = Field(description="ID of message to update")
    add_labels: Optional[List[str]] = Field(description="Labels to add to message")
    remove_labels: Optional[List[str]] = Field(
        description="Labels to remove from message"
    )


class ListDraftsParams(ListInboxItemsParams):
    inbox_id: str = Field(description="ID of inbox to list drafts from")


class GetDraftParams(BaseModel):
    draft_id: str = Field(description="ID of draft to get")


class CreateDraftParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to create draft from")
    to: List[str] = Field(description="Recipients of draft")
    cc: Optional[List[str]] = Field(description="CC recipients of draft")
    bcc: Optional[List[str]] = Field(description="BCC recipients of draft")
    subject: Optional[str] = Field(description="Subject of draft")
    text: Optional[str] = Field(description="Plain text body of draft")
    html: Optional[str] = Field(description="HTML body of draft")
    labels: Optional[List[str]] = Field(description="Labels to add to draft")


class SendDraftParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to send draft from")
    draft_id: str = Field(description="ID of draft to send")
    add_labels: Optional[List[str]] = Field(description="Labels to add to sent message")
    remove_labels: Optional[List[str]] = Field(
        description="Labels to remove from sent message"
    )
