import { describe, expect, it } from 'vitest'
import { agentHref } from './agent-href'

describe('agentHref', () => {
  it('opens a chat waiting on you ahead of the newest one', () => {
    expect(agentHref('atlas', 'waiting', 'newest')).toBe('/chat/atlas/waiting')
  })

  it('opens the newest chat', () => {
    expect(agentHref('atlas', undefined, '20261014_101500_abc')).toBe('/chat/atlas/20261014_101500_abc')
  })

  it('opens the main chat when there are no chats', () => {
    expect(agentHref('atlas')).toBe('/chat/atlas')
  })
})
