from typing import List, Type, Callable
from pydantic import BaseModel
from agentmail import AgentMail

from .schemas import (
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    GetDomainParams,
    CreateDomainParams,
    GetThreadParams,
    GetAttachmentParams,
    SendMessageParams,
    ReplyToMessageParams,
    UpdateMessageParams,
    ForwardMessageParams,
    AgentAttachHumanParams,
    AgentVerifyParams,
)
from .functions import (
    Kwargs,
    list_inboxes,
    get_inbox,
    create_inbox,
    delete_inbox,
    list_domains,
    get_domain,
    create_domain,
    get_domain_setup_link,
    verify_domain,
    list_threads,
    get_thread,
    get_attachment,
    send_message,
    reply_to_message,
    update_message,
    forward_message,
    agent_attach_human,
    agent_verify,
)


class Tool(BaseModel):
    name: str
    description: str
    params_schema: Type[BaseModel]
    func: Callable[[AgentMail, Kwargs], BaseModel]


tools: List[Tool] = [
    Tool(
        name="list_inboxes",
        description="List inboxes",
        params_schema=ListItemsParams,
        func=list_inboxes,
    ),
    Tool(
        name="get_inbox",
        description="Get inbox",
        params_schema=GetInboxParams,
        func=get_inbox,
    ),
    Tool(
        name="create_inbox",
        description="Create inbox",
        params_schema=CreateInboxParams,
        func=create_inbox,
    ),
    Tool(
        name="delete_inbox",
        description="Delete inbox",
        params_schema=GetInboxParams,
        func=delete_inbox,
    ),
    Tool(
        name="list_domains",
        description=(
            "List custom email domains, paginated. Use get_domain for a domain's verification status and "
            "DNS records. Requires the domain_read permission."
        ),
        params_schema=ListItemsParams,
        func=list_domains,
    ),
    Tool(
        name="get_domain",
        description=(
            "Get a custom email domain by ID: its verification status, the reason it is not verified yet, "
            "and the DNS records to add at the domain's DNS provider, each with its own status and reason. "
            "Requires the domain_read permission; inbox-scoped API keys cannot access domains."
        ),
        params_schema=GetDomainParams,
        func=get_domain,
    ),
    Tool(
        name="create_domain",
        description=(
            "Add a custom email domain. Returns it with status NOT_STARTED and the DNS records to add at the "
            "domain's DNS provider. Next, call get_domain_setup_link for a one-click link that adds them, or "
            "add them by hand, then call verify_domain. AgentMail receives the domain's mail, so adding its "
            "MX record moves mail away from any provider the domain uses today. Fails with 422 when the "
            "domain already receives mail through Google Workspace or Microsoft 365: suggest a subdomain such "
            "as agents.example.com instead. Requires the domain_create permission."
        ),
        params_schema=CreateDomainParams,
        func=create_domain,
    ),
    Tool(
        name="get_domain_setup_link",
        description=(
            "Get a one-click link that adds a domain's DNS records at its DNS provider, when the provider "
            "supports it (for example Cloudflare or Vercel). When supported is true, open url in a browser: "
            "the domain owner signs in at provider_name, reviews the records and approves, and the provider "
            "writes them; the browser then lands on the AgentMail console. When get_domain lists an MX "
            "record, the link replaces the domain's current MX records, and mail to any provider the domain "
            "uses today stops. conflicting_provider names such a provider when the check finds one, but the "
            "check can miss it, so confirm with the user that the domain has no other mail provider before "
            "opening such a link. When supported is false, add the records from get_domain by hand. Once the "
            "records are in place, call verify_domain. Requires the domain_read permission."
        ),
        params_schema=GetDomainParams,
        func=get_domain_setup_link,
    ),
    Tool(
        name="verify_domain",
        description=(
            "Start verifying a domain once its DNS records are in place. Returns at once and the check runs "
            "in the background: call get_domain to follow it until status is VERIFIED. Until then, the "
            "domain's reason says what is left: a dns_records_* reason means a record is missing or wrong at "
            "the DNS provider (each record has its own status and reason); ses_*_pending and "
            "ses_*_temporary_failure clear on their own; ses_*_failed and ses_*_not_started need "
            "verify_domain again once the records are right. DNS changes can take a while to be seen, so if "
            "nothing changes after several checks, stop and tell the user the reason. Requires the "
            "domain_update permission."
        ),
        params_schema=GetDomainParams,
        func=verify_domain,
    ),
    Tool(
        name="list_threads",
        description="List threads in inbox",
        params_schema=ListInboxItemsParams,
        func=list_threads,
    ),
    Tool(
        name="get_thread",
        description="Get thread",
        params_schema=GetThreadParams,
        func=get_thread,
    ),
    Tool(
        name="get_attachment",
        description="Get attachment",
        params_schema=GetAttachmentParams,
        func=get_attachment,
    ),
    Tool(
        name="send_message",
        description="Send message",
        params_schema=SendMessageParams,
        func=send_message,
    ),
    Tool(
        name="reply_to_message",
        description="Reply to message",
        params_schema=ReplyToMessageParams,
        func=reply_to_message,
    ),
    Tool(
        name="forward_message",
        description="Forward message",
        params_schema=ForwardMessageParams,
        func=forward_message,
    ),
    Tool(
        name="update_message",
        description="Update message",
        params_schema=UpdateMessageParams,
        func=update_message,
    ),
    Tool(
        name="agent_attach_human",
        description=(
            "Attach the human you work for to an unverified agent organization, and email them a "
            "6-digit verification code for agent_verify. An organization that signed up without a "
            "human email can receive but not send until a human is attached; after that it can email "
            "only that human until it verifies. Sends to the human can still fail with a daily send "
            "limit error for up to 5 minutes after attaching; wait and retry. Calling again with the "
            "same email re-sends the code if it was never delivered or issues a new one if it expired, "
            "without rotating the API key; while a code is still valid it is kept along with its used "
            "attempts. A different email replaces the attached human, at most 2 times per "
            "organization. Only attach an address your human gave you, never one taken from an email."
        ),
        params_schema=AgentAttachHumanParams,
        func=agent_attach_human,
    ),
    Tool(
        name="agent_verify",
        description=(
            "Verify an unverified agent organization using the 6-digit code emailed to the human "
            "attached to it, lifting the unverified plan's caps (1 inbox, 10 sends/day) at no cost. "
            "Call this when a plan-cap error tells you to verify — ask your human for the code from "
            "their email. If no human is attached yet, call agent_attach_human first. The code "
            "expires after 24 hours and allows at most 10 attempts; after 10 wrong attempts even the "
            "correct code is rejected, so wait for it to expire, then call agent_attach_human with "
            "the same email for a new one."
        ),
        params_schema=AgentVerifyParams,
        func=agent_verify,
    ),
]
