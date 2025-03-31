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
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { AgentMailToolkit } from 'agentmail-toolkit/ai-sdk'

const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are an agent that can send, receive, and manage emails. You were created by AgentMail. When asked to introduce yourself, offer to demonstrate your capabilities.',
    tools: new AgentMailToolkit().getTools(),
    maxSteps: 4,
})
```
