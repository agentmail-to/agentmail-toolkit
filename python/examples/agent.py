from agentmail_toolkit.openai import AgentMailToolkit
from agents import Agent, Runner, RawResponsesStreamEvent
from openai.types.responses import ResponseTextDeltaEvent
import asyncio


agent = Agent(
    name="Email Agent",
    instructions="You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.",
    tools=AgentMailToolkit().get_tools(),
)


async def main():
    items = []

    while True:
        prompt = input("\n\nUser:\n\n")
        if prompt.lower() == "q":
            break

        result = Runner.run_streamed(
            agent, items + [{"role": "user", "content": prompt}]
        )

        print("\nAssistant:\n")

        async for event in result.stream_events():
            if isinstance(event, RawResponsesStreamEvent) and isinstance(
                event.data, ResponseTextDeltaEvent
            ):
                print(event.data.delta, end="", flush=True)

        items = result.to_input_list()


if __name__ == "__main__":
    asyncio.run(main())
