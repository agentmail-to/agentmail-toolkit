from typing import Any
from agentmail import AgentMail
from urllib.request import urlopen

import io
import filetype
import pymupdf
import docx


type Kwargs = dict[str, Any]


def list_inboxes(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.list(**kwargs)


def get_inbox(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.get(**kwargs)


def create_inbox(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.create(**kwargs)


def delete_inbox(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.delete(**kwargs)


def list_threads(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.threads.list(**kwargs)


def get_thread(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.threads.get(**kwargs)


def get_attachment(client: AgentMail, kwargs: Kwargs):
    attachment = client.threads.get_attachment(
        thread_id=kwargs["thread_id"], attachment_id=kwargs["attachment_id"]
    )

    try:
        file_bytes = urlopen(attachment.download_url).read()
        file_kind = filetype.guess(file_bytes)
        file_type = file_kind.mime if file_kind else None

        text = None
        if file_type == "application/pdf":
            text = ""
            for page in pymupdf.Document(stream=file_bytes):
                text += page.get_text() + "\n"
        if file_type == "application/zip":
            text = ""
            for paragraph in docx.Document(io.BytesIO(file_bytes)).paragraphs:
                text += paragraph.text + "\n"

        if text is not None:
            return attachment.model_copy(update={"text": text})
    except:
        pass

    return attachment


def send_message(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.messages.send(**kwargs)


def reply_to_message(client: AgentMail, kwargs: Kwargs):
    inbox_id = kwargs.pop("inbox_id")
    message_id = kwargs.pop("message_id")
    return client.inboxes.messages.reply(inbox_id, message_id, **kwargs)


def forward_message(client: AgentMail, kwargs: Kwargs):
    inbox_id = kwargs.pop("inbox_id")
    message_id = kwargs.pop("message_id")
    return client.inboxes.messages.forward(inbox_id, message_id, **kwargs)


def update_message(client: AgentMail, kwargs: Kwargs):
    return client.inboxes.messages.update(**kwargs)
