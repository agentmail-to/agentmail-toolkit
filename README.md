# AgentMail Toolkit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Pre-built integrations for using [AgentMail](https://agentmail.to) with popular AI agent frameworks. Give your agents email capabilities in a few lines of code.

## Supported Frameworks

| Framework | Package | Status |
|-----------|---------|--------|
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | [`agentmail-toolkit`](https://pypi.org/project/agentmail-toolkit/) (Python) | ✅ Stable |
| [Vercel AI SDK](https://sdk.vercel.ai/) | [`agentmail-toolkit`](https://www.npmjs.com/package/agentmail-toolkit) (Node) | ✅ Stable |
| [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) | [`agentmail-mcp`](https://www.npmjs.com/package/agentmail-mcp) | ✅ Stable |

## Quick Start

### Python (OpenAI Agents SDK)

```bash
pip install agentmail-toolkit
```

```python
from agents import Agent
from agentmail_toolkit import AgentMailToolkit

toolkit = AgentMailToolkit(api_key="am_us_xxx")

agent = Agent(
    name="Email Agent",
    instructions="You are a helpful assistant that can send and receive emails.",
    tools=toolkit.get_tools(),
)
```

### Node (Vercel AI SDK)

```bash
npm install agentmail-toolkit
```

```typescript
import { AgentMailToolkit } from "agentmail-toolkit";

const toolkit = new AgentMailToolkit({ apiKey: "am_us_xxx" });
const tools = toolkit.getTools();
```

## What Your Agent Can Do

With the toolkit, your agent gets these capabilities out of the box:

- **Create inboxes** — provision a real email address for any agent
- **Send emails** — compose and send messages with full formatting
- **Read emails** — check inbox, read messages, search threads
- **Reply to threads** — maintain context across email conversations
- **Manage attachments** — send and receive files

## Language-Specific Setup

See the detailed setup guides:

- **Python** — [`/python`](/python)
- **Node/TypeScript** — [`/node`](/node)

## Links

- [AgentMail Website](https://agentmail.to)
- [API Documentation](https://docs.agentmail.to)
- [Python SDK](https://github.com/agentmail-to/agentmail-python)
- [TypeScript SDK](https://github.com/agentmail-to/agentmail-node)
- [MCP Server](https://github.com/agentmail-to/agentmail-mcp)
- [Examples](https://github.com/agentmail-to/agentmail-examples)

## License

MIT
