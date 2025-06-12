from typing import Optional, List
from pydantic import BaseModel, Field


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(description="Max number of items to return")
    page_token: Optional[str] = Field(description="Page token for pagination")


class GetInboxParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to get")


class CreateInboxParams(BaseModel):
    username: Optional[str] = Field(description="Username of inbox to create")
    domain: Optional[str] = Field(description="Domain of inbox to create")
    display_name: Optional[str] = Field(description="Display name of inbox to create")


class ListThreadsParams(ListItemsParams):
    inbox_id: str = Field(description="ID of inbox to list threads from")
    labels: Optional[List[str]] = Field(description="Labels to filter threads by")


class GetThreadParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to get thread from")
    thread_id: str = Field(description="ID of thread to get")


class ListMessagesParams(ListItemsParams):
    inbox_id: str = Field(description="ID of inbox to list messages from")
    labels: Optional[List[str]] = Field(description="Labels to filter messages by")


class GetMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to get message from")
    message_id: str = Field(description="ID of message to get")


class SendMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to send message from")
    to: List[str] = Field(description="Recipients of message")
    cc: Optional[List[str]] = Field(description="CC recipients of message")
    bcc: Optional[List[str]] = Field(description="BCC recipients of message")
    subject: Optional[str] = Field(description="Subject of message")
    text: Optional[str] = Field(description="Plain text body of message")
    html: Optional[str] = Field(description="HTML body of message")


class ReplyToMessageParams(BaseModel):
    inbox_id: str = Field(description="ID of inbox to reply to message from")
    message_id: str = Field(description="ID of message to reply to")
    text: Optional[str] = Field(description="Plain text body of reply")
    html: Optional[str] = Field(description="HTML body of reply")
