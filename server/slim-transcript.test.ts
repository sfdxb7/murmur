import { describe, expect, it } from 'vitest'
import { isSessionMessages, slimTranscript } from './slim-transcript.ts'

describe('a chat transcript on the way to the browser', () => {
  it('keeps the fields the chat reads, and drops the rest', () => {
    const body = Buffer.from(
      JSON.stringify({
        messages: [
          {
            id: 7,
            role: 'assistant',
            content: 'Hello',
            tool_calls: [{ id: 'c1', function: { name: 'web_search', arguments: '{}' } }],
            reasoning: 'brief',
            display_kind: null,
            display_metadata: { reactions: { '👍': 1 } },
            timestamp: 1,
            // Weight the page never draws.
            codex_reasoning_items: 'x'.repeat(1000),
            api_content: { type: 'text', text: 'Hello' },
            reasoning_content: 'brief',
            session_id: 'sess',
            message_uid: 'aaaa',
            tool_call_uids: ['c1'],
          },
        ],
      }),
    )
    const slim = JSON.parse(slimTranscript(body).toString())
    expect(slim.messages).toEqual([
      {
        id: 7,
        role: 'assistant',
        content: 'Hello',
        tool_calls: [{ id: 'c1', function: { name: 'web_search', arguments: '{}' } }],
        reasoning: 'brief',
        display_kind: null,
        display_metadata: { reactions: { '👍': 1 } },
        timestamp: 1,
      },
    ])
    expect(JSON.stringify(slim)).not.toContain('codex_reasoning_items')
    expect(slimTranscript(body).length).toBeLessThan(body.length)
  })

  it('leaves a body it cannot read alone', () => {
    const raw = Buffer.from('not-json')
    expect(slimTranscript(raw)).toBe(raw)
  })

  it('recognises the messages path, encoded ids included', () => {
    expect(isSessionMessages('/hermes/api/sessions/abc/messages')).toBe(true)
    expect(isSessionMessages('/hermes/api/sessions/abc/messages/')).toBe(true)
    expect(isSessionMessages('/hermes/api/sessions/a%2Fb/messages')).toBe(true)
    expect(isSessionMessages('/hermes/api/sessions/abc')).toBe(false)
    expect(isSessionMessages('/hermes/api/sessions/abc/mutation-snapshot')).toBe(false)
  })
})
