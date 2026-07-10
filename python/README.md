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
