import { describe, expect, it } from 'vitest'

// The module reads the page's cookie and storage when it loads.
const memory = new Map<string, string>()
const g = globalThis as { document?: { cookie: string }; localStorage?: Storage }
g.document = { cookie: '' }
g.localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
}
const { toSummary } = await import('./agents')

describe('a chat row preview', () => {
  it('reads as plain words when the message was markdown', () => {
    const row = (preview: string) => toSummary({ id: 'a', preview }).preview
    expect(row('**Done.** Pushed `review-fixes` to origin')).toBe('Done. Pushed review-fixes to origin')
    expect(row('## Summary\nthe rest')).toBe('Summary')
    expect(row('| --- | --- |\n| Email | Inbox triage |')).toBe('Email · Inbox triage')
  })

  it('keeps a plain message as it was', () => {
    expect(toSummary({ id: 'a', preview: '  what time is it in Dubai?' }).preview).toBe('what time is it in Dubai?')
  })
})
