# AgentMail Toolkit

[![npm](https://img.shields.io/npm/v/agentmail-toolkit)](https://www.npmjs.com/package/agentmail-toolkit)
[![pypi](https://img.shields.io/pypi/v/agentmail-toolkit)](https://pypi.org/project/agentmail-toolkit)

Pre-built integrations that connect popular AI agent frameworks to the [AgentMail](https://agentmail.to) email API. Give your agents their own email inboxes in minutes.

## Supported Frameworks

| Framework | Python | TypeScript |
|---|---|---|
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | ✓ | — |
| [Vercel AI SDK](https://sdk.vercel.ai) | — | ✓ |
| [Model Context Protocol (MCP)](https://modelcontextprotocol.io) | ✓ | ✓ |

## Quick Start

### TypeScript (Vercel AI SDK)

```bash
npm install agentmail-toolkit
export AGENTMAIL_API_KEY=am_us_xxx
```

```typescript
import { openai } from "@ai-sdk/openai";
import { AgentMailToolkit } from "agentmail-toolkit/ai-sdk";
import { streamText } from "ai";

const result = streamText({
  model: openai("gpt-4o"),
  messages,
  system: "You are an email agent that can create inboxes, send, and receive emails.",
  tools: new AgentMailToolkit().getTools(),
});
```

### Python (OpenAI Agents SDK)

```bash
pip install agentmail-toolkit
export AGENTMAIL_API_KEY=am_us_xxx
```

```python
from agentmail_toolkit.openai import AgentMailToolkit
from agents import Agent

agent = Agent(
    name="Email Agent",
    instructions="You are an agent that can send, receive, and manage emails.",
    tools=AgentMailToolkit().get_tools(),
)
```

## Packages

| Package | Directory | Docs |
|---|---|---|
| [`agentmail-toolkit`](https://www.npmjs.com/package/agentmail-toolkit) (npm) | [`/node`](./node) | [Node README](./node/README.md) |
| [`agentmail-toolkit`](https://pypi.org/project/agentmail-toolkit) (PyPI) | [`/python`](./python) | [Python README](./python/README.md) |

## Links

- [AgentMail](https://agentmail.to) — The email API for AI agents
- [Documentation](https://docs.agentmail.to)
- [Examples](https://github.com/agentmail-to/agentmail-examples)
- [MCP Server](https://github.com/agentmail-to/agentmail-mcp)
- [Discord](https://discord.gg/ZYN7f7KPjS)
