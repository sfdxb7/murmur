import type { AgentChat } from './chats'

export type StandIn = {
  /** The list as last shown (state/agents.ts), if there is one. */
  kept: AgentChat[] | undefined
  /** Archived or deleted since, whatever the stored rows still say. */
  hidden: ReadonlySet<string>
  /** Chats open in this tab for the agent. */
  opened: readonly string[]
  chats: 'waiting' | 'answered' | 'failed'
  /** Activity and routines: settled once each has answered or failed. */
  rest: 'waiting' | 'settled'
}

/**
 * The list as last shown, while the fresh one is on its way, or undefined
 * when the fresh one (or its error) should show. It steps aside for a chat it
 * can't know of, as one made meanwhile, rather than leave it out.
 */
export function standIn({ kept, hidden, opened, chats, rest }: StandIn) {
  if (!kept || chats === 'failed' || (chats === 'answered' && rest === 'settled')) return undefined
  if (opened.some((id) => !kept.some((c) => c.id === id) && !hidden.has(id))) return undefined
  return kept.filter((c) => !hidden.has(c.id))
}
