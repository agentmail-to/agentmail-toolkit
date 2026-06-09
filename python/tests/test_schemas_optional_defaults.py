from agentmail_toolkit.schemas import CreateInboxParams, ListItemsParams


def test_create_inbox_params_allows_empty():
    # SDK's inboxes.create() accepts no arguments (random inbox);
    # the tool schema must not require username/domain/display_name.
    params = CreateInboxParams()
    assert params.username is None
    assert params.domain is None
    assert params.display_name is None


def test_list_items_params_allows_only_limit():
    params = ListItemsParams(limit=5)
    assert params.page_token is None
