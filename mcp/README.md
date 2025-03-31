### AgentMail MCP Integration

A simple **Model Context Protocol (MCP)** server that integrates with [AgentMail](https://agentmail.to) to dynamically manage email inboxes, list messages, and send or reply to emails—all through an AI assistant such as Claude. This reference implementation demonstrates how to use AgentMail’s API within an MCP server to orchestrate email inboxes on the fly.

### About AgentMail

AgentMail is an API-first email provider that allows AI Agents to create inboxes on the fly to send, recieve and take action on emails. We have layers of intelligence built on top of the email layer optimized for agentic workflows and make data digestable by LLMs. Request an API key here[https://tally.so/r/nrYr4X]!

---

### Important Note

This is a work in progress package as the MCP protocol is still evolving. Will update as soon as new features are added. Join our discord and join the community! [Discord](https://discord.com/invite/ZYN7f7KPjS)

### Features

- **Create new inboxes** dynamically on the fly
- **List and retrieve inboxes** to see what’s active
- **Send emails** from any of your AgentMail inboxes
- **Reply to messages** within existing threads
- **List threads and messages** for a chosen inbox
- **Retrieve attachments** for messages

---

### Prerequisites

- **Python 3.10+**
- **AgentMail API key**
- (Optional) **Claude Desktop** or any other front-end that supports MCP commands

---

### Installation

There exists a PyPi package for this project. Once installed, you can reference it in your Claude Desktop configuration (or run it directly) to enable email management tools.

#### PIP (Local or PyPI)

If you maintain your own Python environment, simply install the package from your virtual enviornment (from PyPI or a local source):

```bash
pip install agentmail-mcp
```

Then run:

```bash
agentmail-mcp –api-key=“YOUR_AGENTMAIL_API_KEY”
```

This will get the server running on your local machine.

# Option 1: Using Claude Desktop

If you want to interact with the server from Claude Desktop, follow these exact steps.

1. Activate your virtual environment.

```bash
source .venv/bin/activate
```

2. Run the line below to find out where the MCP server is located. It should be in some .venv/bin/ directory.

```bash
which agentmail-mcp
```

3. Copy the path that is returned.

4. Paste the path into the `command` field in the `claude_desktop_config.json` file.

5. Restart Claude Desktop.

Here is what the `claude_desktop_config.json` file should look like:

```jsonc
{
  "mcpServers": {
    "agentmail-mcp": {
      "command": "/path/to/agentmail-mcp",
      "args": ["--api-key", "{AGENT_MAIL_API_KEY}"]
    }
  }
}
```

If you don't have a `claude_desktop_config.json` file, create one in the following directory:

On macOS, the config file is typically located at: ~/Library/Application Support/Claude/claude_desktop_config.json

On Windows, it’s usually located at: %APPDATA%/Claude/claude_desktop_config.json

After saving, restart Claude Desktop to load the new MCP server.

### Usage

With your server running in Claude Desktop (or another MCP client), you can prompt Claude with natural language commands that map to AgentMail MCP tools. For example:
• “Create a new inbox named demo.”
• “List all my inboxes.”
• “Send an email from inbox test@agentmail.to to test@example.com with subject ‘Hello’ and body explaining the weather in San Francisco for the past week.
• “Reply to the most recent message in inbox abc123.”

Internally, Claude calls the exposed MCP tools (create_inbox, list_inboxes, send_message, etc.), which in turn call the AgentMail API.

### License

License

MIT License - This project is distributed under the MIT license. Use at your own risk.

⸻
