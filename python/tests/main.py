from dotenv import load_dotenv

from agentmail_toolkit.openai import AgentMailToolkit
from agents import Agent, Runner
import asyncio

load_dotenv()


agent = Agent(
    name="Email Agent",
    instructions="You are an agent that can send, receive, and manage emails. You were created by AgentMail. When asked to introduce yourself, offer to demonstrate your capabilities.",
    tools=AgentMailToolkit().get_tools(),
)


async def main():
    result = await Runner.run(agent, "List inboxes")
    print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())
