# AgentMail Toolkit

[![PyPI](https://img.shields.io/pypi/v/agentmail-toolkit)](https://pypi.org/project/agentmail-toolkit/)
[![npm](https://img.shields.io/npm/v/agentmail-toolkit)](https://www.npmjs.com/package/agentmail-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Give any AI agent its own email inbox.** The AgentMail Toolkit provides pre-built integrations for popular agent frameworks — so your agent can send, receive, read, and reply to real emails in minutes.

🔗 **[agentmail.to](https://agentmail.to)** · 📖 **[Docs](https://docs.agentmail.to)** · 💬 **[Discord](https://discord.gg/ZYN7f7KPjS)**

## Supported Frameworks

| Framework | Python | Node/TypeScript |
|---|---|---|
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | ✅ | — |
| [Vercel AI SDK](https://github.com/vercel/ai) | — | ✅ |
| [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) | ✅ | ✅ |

> Looking for the core SDK? See [agentmail-python](https://github.com/agentmail-to/agentmail-python) or [agentmail-node](https://github.com/agentmail-to/agentmail-node).

## Quick Start

### Python (OpenAI Agents SDK)

```bash
pip install agentmail-toolkit
export AGENTMAIL_API_KEY=your-api-key
```

```python
from agentmail_toolkit.openai import AgentMailToolkit
from agents import Agent, Runner

agent = Agent(
    name="Email Agent",
    instructions="You are an agent that can send, receive, and manage emails.",
    tools=AgentMailToolkit().get_tools(),
)

result = Runner.run_sync(agent, "Create a new inbox and send a hello email to test@example.com")
print(result.final_output)
```

### TypeScript (Vercel AI SDK)

```bash
npm install agentmail-toolkit
export AGENTMAIL_API_KEY=your-api-key
```

```typescript
import { openai } from '@ai-sdk/openai'
import { AgentMailToolkit } from 'agentmail-toolkit/ai-sdk'
import { streamText } from 'ai'

const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are an email agent that can create and manage inboxes, send, and receive emails.',
    tools: new AgentMailToolkit().getTools(),
})
```

## What Can Your Agent Do?

With the AgentMail Toolkit, your agent gets tools to:

- 📬 **Create inboxes** — Spin up email addresses on-demand, programmatically
- 📤 **Send emails** — Compose and send emails with attachments
- 📥 **Receive & read emails** — Poll or get webhooks for incoming mail
- 🔍 **Search emails** — Semantic search across inbox contents
- 🧵 **Manage threads** — Follow and reply to email conversations
- 📎 **Handle attachments** — Extract text from PDFs, images, and documents

## Why AgentMail vs Gmail API / SendGrid / Resend?

| Feature | AgentMail | Gmail API | SendGrid | Resend |
|---|---|---|---|---|
| Programmatic inbox creation | ✅ | ❌ | ❌ | ❌ |
| Two-way email (send + receive) | ✅ | ✅ | Inbound parse only | ❌ |
| Agent framework integrations | ✅ | ❌ | ❌ | ❌ |
| Semantic search | ✅ | ❌ | ❌ | ❌ |
| No OAuth per inbox | ✅ | ❌ | ✅ | ✅ |
| Webhooks + WebSockets | ✅ | Push only | Webhooks | Webhooks |
| Usage-based pricing | ✅ | Per-seat | Per-email | Per-email |

## Examples

Check out [agentmail-examples](https://github.com/agentmail-to/agentmail-examples) for production-ready templates:

- **[Email Agent](https://github.com/agentmail-to/agentmail-examples/tree/main/email-agent)** — Autonomous email responder
- **[Sales Agent](https://github.com/agentmail-to/agentmail-examples/tree/main/sales-agent)** — Outbound sales via email
- **[Support Agent](https://github.com/agentmail-to/agentmail-examples/tree/main/support-agent)** — Auto-respond to support tickets
- **[Invoice Processor](https://github.com/agentmail-to/agentmail-examples/tree/main/invoice-processor)** — Extract and process invoices with Claude vision
- **[Newsletter Digest](https://github.com/agentmail-to/agentmail-examples/tree/main/newsletter-digest)** — Summarize newsletters into a morning digest

## Package Documentation

- **[Python package →](./python)** — OpenAI Agents SDK + MCP integration
- **[Node package →](./node)** — Vercel AI SDK + MCP integration

## Links

- [AgentMail](https://agentmail.to) — The email API for AI agents (YC S25)
- [Documentation](https://docs.agentmail.to)
- [Python SDK](https://github.com/agentmail-to/agentmail-python) · [npm SDK](https://github.com/agentmail-to/agentmail-node)
- [MCP Server](https://github.com/agentmail-to/agentmail-mcp)
- [CLI](https://github.com/agentmail-to/agentmail-cli)

## License

MIT
