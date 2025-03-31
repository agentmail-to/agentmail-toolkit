# AgentMail Toolkit

The AgentMail Toolkit integrates popular agent frameworks and protocols including OpenAI Agents SDK, Vercel AI SDK, and Model Context Protocol (MCP) with the AgentMail API.

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

### Usage

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
