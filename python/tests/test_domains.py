"""The domain tools, driven through the real AgentMail SDK over a fake HTTP layer.

A MagicMock client would accept any method name and any keyword, so it could not
catch a tool calling a method the SDK does not have, or sending a field the API
does not read. Here the SDK builds the real request and the test reads the method,
path, query and body it would have sent.
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from agentmail import AgentMail
from langchain_core.tools import ToolException as LangchainToolException
from livekit.agents import ToolError as LivekitToolError

from agentmail_toolkit import functions
from agentmail_toolkit.schemas import CreateDomainParams, GetDomainParams
from agentmail_toolkit.tools import tools

DOMAIN_TOOLS = ["list_domains", "get_domain", "create_domain", "get_domain_setup_link", "verify_domain"]

SIGNED_URL = (
    "https://dash.cloudflare.com/domainconnect/v2/domainTemplates/providers/agentmail.to/services/email/apply"
    "?domain=example.com&sig=SIG&key=dc1"
)


def domain_body(status="NOT_STARTED", record_status="MISSING"):
    return {
        "domain_id": "example.com",
        "domain": "example.com",
        "status": status,
        "feedback_enabled": True,
        "subdomains_enabled": False,
        "tracking_enabled": False,
        "records": [
            {
                "type": "MX",
                "name": "example.com",
                "value": "inbound-smtp.us-east-1.amazonaws.com",
                "status": record_status,
                "priority": 10,
            }
        ],
        "updated_at": "2026-07-10T12:00:00Z",
        "created_at": "2026-07-10T12:00:00Z",
    }


class FakeApi:
    """Answers the domain routes the way the API does and records every request."""

    def __init__(self, error=None):
        self.requests = []
        self.error = error
        self.verified = False
        self.reads_after_verify = 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        self.requests.append((request.method, request.url.path, dict(request.url.params), body))
        if self.error:
            return httpx.Response(self.error[0], json=self.error[1])

        path = request.url.path
        if request.method == "GET" and path == "/v0/domains":
            item = {k: v for k, v in domain_body().items() if k not in ("status", "records")}
            return httpx.Response(200, json={"count": 1, "domains": [item]})
        if request.method == "POST" and path == "/v0/domains":
            return httpx.Response(200, json=domain_body())
        if path.endswith("/setup-link"):
            return httpx.Response(
                200,
                json={"supported": True, "provider_name": "Cloudflare", "url": SIGNED_URL, "width": 750, "height": 750},
            )
        if path.endswith("/verify"):
            self.verified = True
            return httpx.Response(204)
        if request.method == "GET" and path.startswith("/v0/domains/"):
            if not self.verified:
                return httpx.Response(200, json=domain_body())
            self.reads_after_verify += 1
            if self.reads_after_verify == 1:
                return httpx.Response(200, json=domain_body("VERIFYING"))
            return httpx.Response(200, json=domain_body("VERIFIED", "VALID"))
        return httpx.Response(404, json={"name": "NotFoundError", "message": "Route not found"})


def sdk(api: FakeApi) -> AgentMail:
    return AgentMail(api_key="test-key", httpx_client=httpx.Client(transport=httpx.MockTransport(api)))


CONFLICT_422 = (
    422,
    {
        "name": "UnprocessableEntityError",
        "message": (
            'Domain "example.com" is configured with Google Workspace. Domains with existing email providers '
            "cannot be used simultaneously with AgentMail. Please use a dedicated domain or subdomain."
        ),
    },
)


# --------------------------------------------------------------------------
# catalog
# --------------------------------------------------------------------------


def by_name(name):
    return next(t for t in tools if t.name == name)


def test_domain_tools_sit_after_delete_inbox_and_before_the_thread_tools():
    names = [t.name for t in tools]
    start = names.index("delete_inbox") + 1
    assert names[start : start + len(DOMAIN_TOOLS)] == DOMAIN_TOOLS
    assert names[start + len(DOMAIN_TOOLS)] == "list_threads"


@pytest.mark.parametrize(
    "name, permission",
    [
        ("list_domains", "domain_read"),
        ("get_domain", "domain_read"),
        ("create_domain", "domain_create"),
        ("get_domain_setup_link", "domain_read"),
        ("verify_domain", "domain_update"),
    ],
)
def test_each_tool_names_the_permission_it_needs(name, permission):
    assert f"Requires the {permission} permission" in by_name(name).description


def test_descriptions_use_the_python_field_names():
    for name in DOMAIN_TOOLS:
        description = by_name(name).description
        for camel in ("allowConflictingProvider", "conflictingProvider", "providerName", "domainId"):
            assert camel not in description


def test_create_domain_explains_the_conflict_and_offers_no_override():
    description = by_name("create_domain").description
    assert "422" in description
    assert "Google Workspace or Microsoft 365" in description
    assert "subdomain" in description
    assert "adding its MX record moves mail away from any provider the domain uses today" in description
    assert "allow_conflicting_provider" not in description


def test_setup_link_says_to_open_the_url_and_to_ask_before_replacing_a_provider():
    description = by_name("get_domain_setup_link").description
    assert "open url in a browser" in description
    assert "When get_domain lists an MX record, the link replaces the domain's current MX records" in description
    assert "the check can miss it" in description
    assert "confirm with the user that the domain has no other mail provider before opening such a link" in description
    assert "When supported is false, add the records from get_domain by hand" in description
    assert "verify_domain" in description


def test_verify_domain_says_it_returns_before_the_check_is_done():
    description = by_name("verify_domain").description
    assert "Returns at once" in description
    assert "call get_domain to follow it until status is VERIFIED" in description


def test_verify_domain_maps_each_kind_of_reason_to_the_next_step_and_says_when_to_stop():
    description = by_name("verify_domain").description
    assert "a dns_records_* reason means a record is missing or wrong at the DNS provider" in description
    assert "ses_*_pending and ses_*_temporary_failure clear on their own" in description
    assert "ses_*_failed and ses_*_not_started need verify_domain again" in description
    assert "if nothing changes after several checks, stop and tell the user the reason" in description


# --------------------------------------------------------------------------
# params
# --------------------------------------------------------------------------


def test_get_domain_params_need_the_domain_id():
    assert GetDomainParams(domain_id="example.com").domain_id == "example.com"
    with pytest.raises(ValueError):
        GetDomainParams()


def test_create_domain_params_need_only_the_domain():
    schema = CreateDomainParams.model_json_schema()
    assert schema["required"] == ["domain"]
    assert set(schema["properties"]) == {
        "domain",
        "feedback_enabled",
        "subdomains_enabled",
        "tracking_enabled",
    }
    with pytest.raises(ValueError):
        CreateDomainParams()


def test_create_domain_params_state_each_default():
    properties = CreateDomainParams.model_json_schema()["properties"]
    assert "Default true" in properties["feedback_enabled"]["description"]
    assert "Default false" in properties["subdomains_enabled"]["description"]
    assert "Default false" in properties["tracking_enabled"]["description"]


# --------------------------------------------------------------------------
# the requests the SDK sends
# --------------------------------------------------------------------------


def test_list_domains_pages_with_limit_and_token():
    api = FakeApi()
    result = functions.list_domains(sdk(api), {"limit": 5, "page_token": "tok"})

    assert api.requests == [("GET", "/v0/domains", {"limit": "5", "page_token": "tok"}, None)]
    assert result.count == 1
    assert result.domains[0].domain == "example.com"


def test_get_domain_reads_that_domain():
    api = FakeApi()
    result = functions.get_domain(sdk(api), {"domain_id": "example.com"})

    assert api.requests == [("GET", "/v0/domains/example.com", {}, None)]
    assert result.status == "NOT_STARTED"
    assert result.records[0].status == "MISSING"


def test_create_domain_sends_only_the_domain_when_no_flag_is_set():
    api = FakeApi()
    functions.create_domain(sdk(api), {"domain": "example.com"})

    assert api.requests == [("POST", "/v0/domains", {}, {"domain": "example.com"})]


def test_create_domain_sends_every_flag_set_false_included():
    api = FakeApi()
    functions.create_domain(
        sdk(api),
        {
            "domain": "example.com",
            "feedback_enabled": False,
            "subdomains_enabled": True,
            "tracking_enabled": False,
        },
    )

    assert api.requests[0][3] == {
        "domain": "example.com",
        "feedback_enabled": False,
        "subdomains_enabled": True,
        "tracking_enabled": False,
    }


def test_create_domain_never_sends_allow_conflicting_provider():
    api = FakeApi()
    functions.create_domain(sdk(api), {"domain": "example.com", "allow_conflicting_provider": True, "pod_id": "pod_2"})

    assert api.requests[0][3] == {"domain": "example.com"}


def test_create_domain_without_a_domain_makes_no_request():
    api = FakeApi()
    with pytest.raises(ValueError):
        functions.create_domain(sdk(api), {"feedback_enabled": True})
    assert api.requests == []


def test_get_domain_setup_link_returns_the_signed_url_unchanged():
    api = FakeApi()
    result = functions.get_domain_setup_link(sdk(api), {"domain_id": "example.com"})

    assert api.requests == [("GET", "/v0/domains/example.com/setup-link", {}, None)]
    assert result.supported is True
    assert result.provider_name == "Cloudflare"
    assert result.url == SIGNED_URL


def test_verify_domain_posts_to_verify_and_returns_none():
    api = FakeApi()
    result = functions.verify_domain(sdk(api), {"domain_id": "example.com"})

    assert api.requests == [("POST", "/v0/domains/example.com/verify", {}, None)]
    assert result is None


# --------------------------------------------------------------------------
# adapters
# --------------------------------------------------------------------------


def openai_tool(api, name):
    from agentmail_toolkit.openai import AgentMailToolkit

    return AgentMailToolkit(client=sdk(api))._tools[name]


def test_openai_create_domain_with_every_key_present_as_null():
    """The OpenAI adapter's strict schema makes the model send every key, with null for
    the flags it leaves unset. The API reads a null in a create body as unset, so no
    flag may arrive with a value the model did not choose."""
    api = FakeApi()
    tool = openai_tool(api, "create_domain")
    arguments = {
        "domain": "example.com",
        "feedback_enabled": None,
        "subdomains_enabled": None,
        "tracking_enabled": None,
    }

    result = asyncio.run(tool.on_invoke_tool(MagicMock(), json.dumps(arguments)))

    sent = api.requests[0][3]
    assert {key: value for key, value in sent.items() if value is not None} == {"domain": "example.com"}
    assert json.loads(result)["status"] == "NOT_STARTED"


def test_openai_create_domain_schema_is_strict_so_every_key_arrives():
    tool = openai_tool(FakeApi(), "create_domain")
    assert tool.strict_json_schema is True
    assert tool.params_json_schema["additionalProperties"] is False
    assert set(tool.params_json_schema["required"]) == {
        "domain",
        "feedback_enabled",
        "subdomains_enabled",
        "tracking_enabled",
    }


def test_openai_setup_link_result_carries_the_url():
    tool = openai_tool(FakeApi(), "get_domain_setup_link")
    result = json.loads(asyncio.run(tool.on_invoke_tool(MagicMock(), json.dumps({"domain_id": "example.com"}))))

    assert result["supported"] is True
    assert result["url"] == SIGNED_URL


def test_openai_verify_domain_returns_ok():
    tool = openai_tool(FakeApi(), "verify_domain")
    assert asyncio.run(tool.on_invoke_tool(MagicMock(), json.dumps({"domain_id": "example.com"}))) == "OK"


def test_openai_create_domain_conflict_raises_with_the_provider_named():
    tool = openai_tool(FakeApi(error=CONFLICT_422), "create_domain")

    with pytest.raises(RuntimeError, match="Google Workspace") as raised:
        asyncio.run(tool.on_invoke_tool(MagicMock(), json.dumps({"domain": "example.com"})))
    assert "HTTP 422" in str(raised.value)


def test_langchain_create_domain_passes_the_flags_through():
    from agentmail_toolkit.langchain import AgentMailToolkit

    api = FakeApi()
    tool = AgentMailToolkit(client=sdk(api))._tools["create_domain"]
    tool.invoke({"domain": "example.com", "subdomains_enabled": True})

    # Only what the model set reaches the API with a value; nothing else may carry one.
    sent = api.requests[0][3]
    assert {key: value for key, value in sent.items() if value is not None} == {
        "domain": "example.com",
        "subdomains_enabled": True,
    }


def test_langchain_verify_domain_refusal_is_an_error_message():
    from agentmail_toolkit.langchain import AgentMailToolkit

    api = FakeApi(error=(403, {"name": "ForbiddenError", "message": "Forbidden"}))
    tool = AgentMailToolkit(client=sdk(api))._tools["verify_domain"]

    message = tool.run(tool_input={"domain_id": "example.com"}, tool_call_id="call_1")

    assert message.status == "error"
    assert "HTTP 403" in message.content
    with pytest.raises(LangchainToolException):
        tool.func(domain_id="example.com")


def _livekit_context():
    context = MagicMock()
    context.session.generate_reply = AsyncMock()
    return context


def test_livekit_verify_domain_returns_ok():
    from agentmail_toolkit.livekit import AgentMailToolkit

    tool = AgentMailToolkit(client=sdk(FakeApi()))._tools["verify_domain"]
    assert asyncio.run(tool({"domain_id": "example.com"}, _livekit_context())) == "OK"


def test_livekit_create_domain_drops_an_override_the_model_was_not_offered():
    from agentmail_toolkit.livekit import AgentMailToolkit

    api = FakeApi()
    tool = AgentMailToolkit(client=sdk(api))._tools["create_domain"]
    asyncio.run(tool({"domain": "example.com", "allow_conflicting_provider": True}, _livekit_context()))

    assert api.requests[0][3] == {"domain": "example.com"}


def test_livekit_get_domain_not_found_raises_tool_error():
    from agentmail_toolkit.livekit import AgentMailToolkit

    api = FakeApi(error=(404, {"name": "NotFoundError", "message": "Domain not found"}))
    tool = AgentMailToolkit(client=sdk(api))._tools["get_domain"]

    with pytest.raises(LivekitToolError, match="Domain not found"):
        asyncio.run(tool({"domain_id": "nobody.example"}, _livekit_context()))


# --------------------------------------------------------------------------
# start to finish
# --------------------------------------------------------------------------


def test_create_link_verify_then_get_until_verified():
    from agentmail_toolkit.openai import AgentMailToolkit

    api = FakeApi()
    toolkit = AgentMailToolkit(client=sdk(api))._tools

    def call(name, arguments):
        return asyncio.run(toolkit[name].on_invoke_tool(MagicMock(), json.dumps(arguments)))

    created = json.loads(call("create_domain", {"domain": "example.com"}))
    domain_id = created["domain_id"]
    assert created["status"] == "NOT_STARTED"

    link = json.loads(call("get_domain_setup_link", {"domain_id": domain_id}))
    assert link["url"] == SIGNED_URL

    # Here the agent opens link["url"] and the domain owner approves at the provider.

    assert call("verify_domain", {"domain_id": domain_id}) == "OK"
    statuses = [json.loads(call("get_domain", {"domain_id": domain_id}))["status"] for _ in range(2)]

    assert statuses == ["VERIFYING", "VERIFIED"]
    assert [(method, path) for method, path, _, _ in api.requests] == [
        ("POST", "/v0/domains"),
        ("GET", "/v0/domains/example.com/setup-link"),
        ("POST", "/v0/domains/example.com/verify"),
        ("GET", "/v0/domains/example.com"),
        ("GET", "/v0/domains/example.com"),
    ]
