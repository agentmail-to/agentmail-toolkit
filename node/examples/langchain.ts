import { createInterface } from 'node:readline/promises'
import { ChatOpenAI } from '@langchain/openai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, AIMessage, SystemMessage, isAIMessageChunk } from '@langchain/core/messages'

import { AgentMailToolkit } from '../src/langchain'

const terminal = createInterface({ input: process.stdin, output: process.stdout })

const agent = createReactAgent({
    llm: new ChatOpenAI({ model: 'gpt-4o' }),
    tools: new AgentMailToolkit().getTools(),
})

const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage('You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.'),
]

async function main() {
    while (true) {
        const prompt = await terminal.question('\nUser:\n\n')

        if (prompt.toLowerCase() === 'q') process.exit(0)

        messages.push(new HumanMessage(prompt))

        process.stdout.write('\nAssistant:\n\n')

        const result = await agent.stream({ messages }, { streamMode: 'messages' })

        let response = ''
        for await (const [message, _] of result) {
            if (!isAIMessageChunk(message)) continue
            process.stdout.write(message.text)
            response += message.text
        }
        process.stdout.write('\n')

        messages.push(new AIMessage(response))
    }
}

main().catch(console.error)
