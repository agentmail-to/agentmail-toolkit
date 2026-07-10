"""SDK call-shape and result pass-through tests for each tool function.

Each test calls the toolkit function directly with a mocked AgentMail client
and asserts *which* underlying SDK method got called and with *what*
arguments — this is what would have caught F1 (create_inbox's flat-kwargs
call raising TypeError against the real SDK) and F7 (get_attachment calling
the unscoped client.threads.get_attachment instead of the inbox-scoped one).
"""

from datetime import datetime, timezone

from agentmail.inboxes import CreateInboxRequest
from agentmail.inboxes.types.inbox import Inbox

from agentmail_toolkit import functions


def test_list_inboxes_call_shape(mock_client):
    functions.list_inboxes(mock_client, {"limit": 5, "page_token": "tok"})
    mock_client.inboxes.list.assert_called_once_with(limit=5, page_token="tok")


def test_get_inbox_call_shape(mock_client):
    functions.get_inbox(mock_client, {"inbox_id": "in_1"})
    mock_client.inboxes.get.assert_called_once_with(inbox_id="in_1")


def test_create_inbox_builds_request_object(mock_client):
    """F1: the pinned SDK requires request=CreateInboxRequest(...), not flat kwargs."""
    functions.create_inbox(
        mock_client,
        {"username": "foo", "domain": "bar.com", "display_name": "Foo Bar"},
    )
    mock_client.inboxes.create.assert_called_once()
    _, call_kwargs = mock_client.inboxes.create.call_args
    assert set(call_kwargs) == {"request"}
    request = call_kwargs["request"]
    assert isinstance(request, CreateInboxRequest)
    assert request.username == "foo"
    assert request.domain == "bar.com"
    assert request.display_name == "Foo Bar"


def test_delete_inbox_returns_stable_none(mock_client):
    """Void op: SDK returns None on success; the function must pass it through
    unchanged, not raise or invent a value."""
    mock_client.inboxes.delete.return_value = None
    result = functions.delete_inbox(mock_client, {"inbox_id": "in_1"})
    mock_client.inboxes.delete.assert_called_once_with(inbox_id="in_1")
    assert result is None


def test_list_threads_call_shape(mock_client):
    functions.list_threads(
        mock_client,
        {"inbox_id": "in_1", "ascending": True, "include_spam": True},
    )
    mock_client.inboxes.threads.list.assert_called_once_with(
        inbox_id="in_1", ascending=True, include_spam=True
    )


def test_get_thread_call_shape(mock_client):
    functions.get_thread(mock_client, {"inbox_id": "in_1", "thread_id": "th_1"})
    mock_client.inboxes.threads.get.assert_called_once_with(
        inbox_id="in_1", thread_id="th_1"
    )


def test_get_attachment_scoped_to_inbox(mock_client, make_attachment):
    """F7: must call the inbox-scoped client.inboxes.threads.get_attachment,
    not the unscoped client.threads.get_attachment."""
    mock_client.inboxes.threads.get_attachment.return_value = make_attachment(
        size=10, download_url="ftp://example.com/file"
    )
    functions.get_attachment(
        mock_client,
        {"inbox_id": "in_1", "thread_id": "th_1", "attachment_id": "att_1"},
    )
    mock_client.inboxes.threads.get_attachment.assert_called_once_with(
        inbox_id="in_1", thread_id="th_1", attachment_id="att_1"
    )
    mock_client.threads.get_attachment.assert_not_called()


def test_send_message_call_shape(mock_client):
    functions.send_message(mock_client, {"inbox_id": "in_1", "to": ["a@b.com"]})
    mock_client.inboxes.messages.send.assert_called_once_with(
        inbox_id="in_1", to=["a@b.com"]
    )


def test_reply_to_message_call_shape_and_no_mutation(mock_client):
    """F10: kwargs dict passed by the caller must not be mutated in place."""
    kwargs = {"inbox_id": "in_1", "message_id": "m_1", "text": "hi"}
    original = dict(kwargs)
    functions.reply_to_message(mock_client, kwargs)
    mock_client.inboxes.messages.reply.assert_called_once_with(
        "in_1", "m_1", text="hi"
    )
    assert kwargs == original


def test_forward_message_call_shape_and_no_mutation(mock_client):
    kwargs = {"inbox_id": "in_1", "message_id": "m_1", "to": ["a@b.com"]}
    original = dict(kwargs)
    functions.forward_message(mock_client, kwargs)
    mock_client.inboxes.messages.forward.assert_called_once_with(
        "in_1", "m_1", to=["a@b.com"]
    )
    assert kwargs == original


def test_update_message_call_shape(mock_client):
    functions.update_message(
        mock_client,
        {"inbox_id": "in_1", "message_id": "m_1", "add_labels": ["x"]},
    )
    mock_client.inboxes.messages.update.assert_called_once_with(
        inbox_id="in_1", message_id="m_1", add_labels=["x"]
    )


def test_get_inbox_passes_through_real_sdk_model(mock_client):
    """Serialization: the function must return the real SDK model unchanged
    (not unwrap/rewrap it), so downstream .model_dump_json() calls work."""
    inbox = Inbox(
        pod_id="pod_1",
        inbox_id="in_1",
        email="in_1@agentmail.to",
        updated_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    mock_client.inboxes.get.return_value = inbox
    result = functions.get_inbox(mock_client, {"inbox_id": "in_1"})
    assert result is inbox
    assert result.model_dump_json() == inbox.model_dump_json()
