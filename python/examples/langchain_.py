from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain.schema import AIMessage, HumanMessage

from agentmail_toolkit.langchain import AgentMailToolkit

agent = create_react_agent(
    model=ChatOpenAI(model="gpt-4o"),
    prompt="You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.",
    tools=AgentMailToolkit().get_tools(),
)


def main():
    messages = []

    while True:
        prompt = input("\n\nUser:\n\n")
        if prompt.lower() == "q":
            break

        messages.append(HumanMessage(prompt))

        result = agent.stream({"messages": messages}, stream_mode="messages")

        print("\nAssistant:\n")

        response = ""
        for chunk, _ in result:
            if not isinstance(chunk, AIMessage):
                continue

            print(chunk.content, end="", flush=True)
            response += chunk.content

        messages.append(AIMessage(response))


if __name__ == "__main__":
    main()
