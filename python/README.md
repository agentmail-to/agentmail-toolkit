# AgentMail Toolkit

The AgentMail Toolkit integrates popular agent frameworks including OpenAI Agents SDK, LangChain, and LiveKit Agents with the AgentMail API.

## Setup

Get your API key from [AgentMail](https://agentmail.to)

### Installation

```sh
pip install agentmail-toolkit
```

### Configuration

```sh
export AGENTMAIL_API_KEY=your-api-key
```

### Usage

```python
from agentmail_toolkit.openai import AgentMailToolkit
from agents import Agent

agent = Agent(
    name="Email Agent",
    instructions="You are an agent created by AgentMail that can send, receive, and manage emails.",
    tools=AgentMailToolkit().get_tools(),
)
```

### Errors

A failed tool call (an AgentMail API error, or any other exception) is surfaced
as a real failure, not a disguised success — each adapter raises the way its
framework expects: `RuntimeError` (OpenAI Agents SDK), `ToolException`
(LangChain, which becomes an error `ToolMessage`), or `ToolError` (LiveKit
Agents).

### Attachment downloads

`get_attachment`'s text extraction (PDF/DOCX) only follows `https://`
download URLs, applies a 15-second fetch timeout, and caps the downloaded
body at 25MB — attachments outside these bounds, or that fail to parse, are
returned without extracted text instead of raising.
