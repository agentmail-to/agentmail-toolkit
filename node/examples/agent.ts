import { createInterface } from 'node:readline/promises'
import { openai } from '@ai-sdk/openai'
import { type CoreMessage, streamText } from 'ai'

import { AgentMailToolkit } from '../src/ai-sdk'

const terminal = createInterface({ input: process.stdin, output: process.stdout })

const messages: CoreMessage[] = []

async function main() {
    while (true) {
        const input = await terminal.question('\nUser:\n\n')

        if (input.toLowerCase() === 'q') process.exit(0)

        messages.push({ role: 'user', content: input })

        const result = streamText({
            model: openai('gpt-4o'),
            messages,
            system: 'You are an email agent created by AgentMail that can create and manage inboxes as well as send and receive emails.',
            tools: new AgentMailToolkit().getTools(),
            maxSteps: 4,
        })

        process.stdout.write('\nAssistant:\n\n')

        let response = ''
        for await (const delta of result.textStream) {
            process.stdout.write(delta)
            response += delta
        }
        process.stdout.write('\n')

        messages.push({ role: 'assistant', content: response })
    }
}

main().catch(console.error)
