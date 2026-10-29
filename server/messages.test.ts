import { describe, expect, it } from 'vitest'
import { slimMessages } from './messages.ts'

const row = {
  id: 4,
  role: 'assistant',
  content: 'It printed hello.',
  reasoning: 'Checked the command.',
  api_content: 'It printed hello.\n\nUmbrel Runtime Context:\n' + 'x'.repeat(4000),
  codex_message_items: 'e'.repeat(20_000),
  codex_reasoning_items: [{ encrypted_content: 'y'.repeat(8000) }],
  reasoning_details: 'z'.repeat(3000),
  finish_reason: 'stop',
  timestamp: 1791893804.29,
}

describe('slimMessages', () => {
  it('drops model-only columns and keeps what the thread reads', () => {
    const raw = JSON.stringify({ messages: [row, { id: 5, role: 'tool', content: '{"output":"hello"}', tool_call_id: 'call_1' }] })
    const slimmed = slimMessages(raw)!
    const body = JSON.parse(slimmed) as { messages: Record<string, unknown>[] }
    expect(body.messages[0]).toEqual({
      id: 4,
      role: 'assistant',
      content: 'It printed hello.',
      reasoning: 'Checked the command.',
      timestamp: 1791893804.29,
    })
    expect(body.messages[1]).toMatchObject({ role: 'tool', content: '{"output":"hello"}', tool_call_id: 'call_1' })
    expect(slimmed.length).toBeLessThan(raw.length / 5)
  })

  it('accepts the data envelope and leaves anything else untouched', () => {
    expect(JSON.parse(slimMessages(JSON.stringify({ data: [row] }))!).data).toHaveLength(1)
    expect(slimMessages('not json')).toBeNull()
    expect(slimMessages(JSON.stringify({ sessions: [] }))).toBeNull()
  })

  it('keeps what a tool row is read for and drops the long output', () => {
    const output = 'x'.repeat(12_000) + 'BLOCKED: disk full'
    const content = JSON.stringify({
      output,
      exit_code: 1,
      error: 'disk full',
      host_image: '/opt/data/images/shot.png',
      messages: [{ id: 'm1', subject: 'Boarding pass', body: 'y'.repeat(8_000) }],
    })
    const raw = JSON.stringify({ messages: [{ id: 9, role: 'tool', tool_name: 'terminal', content }] })
    const slimmed = JSON.parse(slimMessages(raw)!) as { messages: { content: string }[] }
    const tool = JSON.parse(slimmed.messages[0].content) as {
      output: string
      exit_code: number
      error: string
      host_image: string
      messages: { id: string; subject: string; body: string }[]
    }
    expect(tool.exit_code).toBe(1)
    expect(tool.error).toBe('disk full')
    expect(tool.host_image).toBe('/opt/data/images/shot.png')
    expect(tool.messages[0]).toMatchObject({ id: 'm1', subject: 'Boarding pass' })
    expect(tool.output.length).toBeLessThan(output.length / 4)
    expect(tool.output.endsWith('BLOCKED: disk full')).toBe(true)
    expect(tool.messages[0].body.length).toBeLessThan(8_000)
    expect(slimmed.messages[0].content.length).toBeLessThan(content.length / 3)
  })

  it('drops inlined file bytes from a user turn and keeps the attachment markers', () => {
    const content = [
      '@file:attachments/notes.txt',
      '',
      'What does this say?',
      '',
      '--- Attached Context ---',
      '',
      '📄 @file:attachments/notes.txt (8 tokens)',
      '```',
      'The secret word is MANGO-42.',
      '```',
      'Umbrel Runtime Context:',
      'z'.repeat(4_000),
    ].join('\n')
    const slimmed = JSON.parse(slimMessages(JSON.stringify({ messages: [{ id: 1, role: 'user', content }] }))!) as {
      messages: { content: string }[]
    }
    expect(slimmed.messages[0].content).toContain('What does this say?')
    expect(slimmed.messages[0].content).toContain('@file:attachments/notes.txt')
    expect(slimmed.messages[0].content).not.toContain('MANGO-42')
    expect(slimmed.messages[0].content).not.toContain('Umbrel Runtime Context')
    expect(slimmed.messages[0].content.length).toBeLessThan(content.length / 5)
  })
})
