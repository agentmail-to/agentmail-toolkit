# AgentMail Toolkit

The AgentMail Toolkit integrates the AgentMail API with popular agent frameworks and protocols: the Model Context Protocol (MCP), the Vercel AI SDK, LangChain, and clawdbot. A framework-agnostic generic export is also available.

## Setup

Get your API key from [AgentMail](https://agentmail.to)

### Installation

```sh
npm install agentmail-toolkit
```

### Configuration

```sh
export AGENTMAIL_API_KEY=your-api-key
```

## Usage

Each framework has its own subpath export. All tools share the same input/output schemas and descriptions - only the wrapping and error-signaling convention differs per framework, matching that framework's own idioms.

### Vercel AI SDK (`agentmail-toolkit/ai-sdk`)

```typescript
import { openai } from '@ai-sdk/openai'
import { AgentMailToolkit } from 'agentmail-toolkit/ai-sdk'
import { streamText } from 'ai'

const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.',
    tools: new AgentMailToolkit().getTools(),
})
```

A failed tool call throws, which the AI SDK surfaces as a distinct `tool-error` part rather than a successful result.

### MCP (`agentmail-toolkit/mcp`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { AgentMailToolkit } from 'agentmail-toolkit/mcp'

const server = new McpServer({ name: 'agentmail', version: '1.0.0' })
for (const tool of new AgentMailToolkit().getTools()) {
    server.registerTool(tool.name, tool, tool.callback)
}
```

Every tool declares an `outputSchema` and returns matching `structuredContent` alongside a JSON-stringified text block on success. On error, the result carries `isError: true` and an actionable text message instead of structured content.

Failed calls and attachments returned without their extracted text are reported to a logger. By default each is one console line: AgentMail API 4xx errors on `console.warn`, everything else on `console.error`. A host with its own log format passes `logger`, whose `warn` and `error` each receive a typed `ToolkitLogEvent` (the tool, its status and API error body, the message the caller got):

```typescript
import { AgentMailToolkit, type ToolkitLogEvent } from 'agentmail-toolkit/mcp'

const toolkit = new AgentMailToolkit(client, {
    logger: {
        warn: (event: ToolkitLogEvent) => myLogger.warn(event),
        error: (event: ToolkitLogEvent) => myLogger.error(event),
    },
})
```

`invoke(name, client, args, { logger })` overrides it for one call.

### LangChain (`agentmail-toolkit/langchain`)

```typescript
import { AgentMailToolkit } from 'agentmail-toolkit/langchain'
import { createAgent } from 'langchain'

const agent = createAgent({
    model: 'openai:gpt-4o',
    tools: new AgentMailToolkit().getTools(),
})
```

A failed tool call throws, which LangChain propagates as a rejected tool run instead of a JSON-stringified success value.

### clawdbot (`agentmail-toolkit/clawdbot`)

```typescript
import { AgentMailToolkit } from 'agentmail-toolkit/clawdbot'

const tools = new AgentMailToolkit().getTools()
```

A failed tool call throws; clawdbot's agent loop catches it and marks the tool result as errored.

### Generic (`agentmail-toolkit`)

```typescript
import { AgentMailToolkit } from 'agentmail-toolkit'

const tools = new AgentMailToolkit().getTools()
```

Exposes each tool's `name`, `description`, `paramsSchema`, `outputSchema`, and a `func` for frameworks not covered above. A failed call throws a concise `Error` rather than the AgentMail SDK's raw, unbounded error dump.
