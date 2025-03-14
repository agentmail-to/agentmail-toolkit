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
    items = []

    while True:
        user_input = input("\nUser:\n\n")
        if user_input.lower() == "q":
            break

        result = await Runner.run(
            agent, items + [{"role": "user", "content": user_input}]
        )
        # print(f"\nAssistant:\n\n{result.final_output}")

        for item in result.new_items:
            if isinstance(item.raw_item, dict):
                item_type = item.raw_item["type"]
            else:
                item_type = item.raw_item.type

            match item_type:
                case "function_call":
                    print(
                        f"\n`Tool Call`:\n\nName: {item.raw_item.name}\nArgs: {item.raw_item.arguments}"
                    )
                case "function_call_output":
                    print(f"\n`Tool Call Result`:\n\n{item.raw_item['output']}")
                case "message":
                    print(f"\nAssistant:")
                    for content in item.raw_item.content:
                        print(f"\n{content.text}")

        items = result.to_input_list()


if __name__ == "__main__":
    asyncio.run(main())
