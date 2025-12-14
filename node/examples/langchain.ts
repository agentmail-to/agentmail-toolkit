import { createInterface } from 'node:readline/promises'
import { createAgent, SystemMessage, HumanMessage, AIMessage } from 'langchain'

import { AgentMailToolkit } from '../src/langchain.js'

const terminal = createInterface({ input: process.stdin, output: process.stdout })

const agent = createAgent({
    model: 'openai:gpt-4o',
    tools: new AgentMailToolkit().getTools(),
    systemPrompt: 'You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.',
})

const messages: (SystemMessage | HumanMessage | AIMessage)[] = []

async function main() {
    while (true) {
        const prompt = await terminal.question('\nUser:\n\n')

        if (prompt.toLowerCase() === 'q') process.exit(0)

        messages.push(new HumanMessage(prompt))

        process.stdout.write('\nAssistant:\n\n')

        const result = await agent.stream({ messages }, { streamMode: 'messages' })

        let response = ''
        for await (const [chunk, _] of result) {
            if (chunk.type !== 'ai') continue

            process.stdout.write(chunk.text)
            response += chunk.text
        }
        process.stdout.write('\n')

        messages.push(new AIMessage(response))
    }
}

main().catch(console.error)
