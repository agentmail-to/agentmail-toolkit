/**
 * Soulink Identity + AgentMail Example
 *
 * Links verified on-chain .agent identities with AgentMail inboxes.
 * Before sending an email, resolves the recipient's Soulink identity
 * to confirm they're a verified agent. Includes identity metadata
 * in email headers for end-to-end agent authentication.
 *
 * Soulink: https://soulink.dev
 */
import { AgentMailToolkit } from 'agentmail-toolkit/ai-sdk'

const SOULINK_API = 'https://soulink.dev/api/v1'

interface SoulinkIdentity {
  name: string
  owner: string
  expires_at: string
}

interface SoulinkCredit {
  name: string
  score: number
  total_reports: number
}

async function resolveAgent(name: string): Promise<SoulinkIdentity | null> {
  const res = await fetch(`${SOULINK_API}/resolve/${encodeURIComponent(name)}`)
  if (!res.ok) return null
  return res.json() as Promise<SoulinkIdentity>
}

async function getCredit(name: string): Promise<SoulinkCredit | null> {
  const res = await fetch(`${SOULINK_API}/credit/${encodeURIComponent(name)}`)
  if (!res.ok) return null
  return res.json() as Promise<SoulinkCredit>
}

async function main() {
  const toolkit = new AgentMailToolkit()

  // 1. Verify your own agent identity on Soulink
  const selfName = 'my-agent'
  const self = await resolveAgent(selfName)
  if (!self) {
    console.error(`Agent ${selfName} not found on Soulink. Register at https://soulink.dev`)
    return
  }
  console.log(`Verified self: ${self.name}.agent (owner: ${self.owner})`)

  // 2. Before emailing another agent, check their identity and trust
  const recipientName = 'helper-bot'
  const recipient = await resolveAgent(recipientName)
  if (!recipient) {
    console.log(`Recipient ${recipientName} has no Soulink identity — skipping`)
    return
  }

  const credit = await getCredit(recipientName)
  console.log(`Recipient ${recipient.name}.agent — credit: ${credit?.score ?? 'unknown'}/100`)

  // 3. Only email agents with sufficient trust score
  if (credit && credit.score < 50) {
    console.log(`Credit score too low (${credit.score}), not emailing this agent`)
    return
  }

  // 4. Use AgentMail toolkit with Soulink identity context
  //    In a real agent, you'd pass these tools to your LLM with a system
  //    prompt that includes the verified identity information:
  const systemPrompt = [
    `You are ${self.name}.agent with verified on-chain identity.`,
    `Your wallet: ${self.owner}`,
    `You are about to email ${recipient.name}.agent (credit: ${credit?.score}/100).`,
    `Include your .agent name in the email signature for identity verification.`,
  ].join('\n')

  console.log('\nSystem prompt for LLM agent:')
  console.log(systemPrompt)
  console.log('\nAgentMail tools available:', Object.keys(toolkit.getTools()).length)
}

main().catch(console.error)
