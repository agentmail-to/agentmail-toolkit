from typing import Optional, List
from pydantic import BaseModel, Field


class ListItemsParams(BaseModel):
    limit: Optional[int] = Field(description="The maximum number of items to return")
    last_key: Optional[str] = Field(description="The last key to use for pagination")


class GetInboxParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to get")


class CreateInboxParams(BaseModel):
    username: str = Field(description="The username of the inbox to create")
    display_name: str = Field(description="The display name of the inbox to create")


class ListThreadsParams(ListItemsParams):
    inbox_id: str = Field(description="The ID of the inbox to list threads for")
    received: bool = Field(description="Whether to filter by received threads")
    sent: bool = Field(description="Whether to filter by sent threads")


class GetThreadParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to get the thread for")
    thread_id: str = Field(description="The ID of the thread to get")


class ListMessagesParams(ListItemsParams):
    inbox_id: str = Field(description="The ID of the inbox to list messages for")


class GetMessageParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to get the message for")
    message_id: str = Field(description="The ID of the message to get")


class GetAttachmentParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to get the attachment for")
    message_id: str = Field(
        description="The ID of the message to get the attachment for"
    )
    attachment_id: str = Field(description="The ID of the attachment to get")


class SendMessageParams(BaseModel):
    inbox_id: str = Field(description="The ID of the inbox to send the message from")
    to: List[str] = Field(description="The list of recipients")
    cc: Optional[List[str]] = Field(description="The list of CC recipients")
    bcc: Optional[List[str]] = Field(description="The list of BCC recipients")
    subject: Optional[str] = Field(description="The subject of the message")
    text: Optional[str] = Field(description="The plain text body of the message")
    html: Optional[str] = Field(description="The HTML body of the message")


class ReplyToMessageParams(BaseModel):
    inbox_id: str = Field(
        description="The ID of the inbox to reply to the message from"
    )
    message_id: str = Field(description="The ID of the message to reply to")
    text: Optional[str] = Field(description="The plain text body of the reply")
    html: Optional[str] = Field(description="The HTML body of the reply")
