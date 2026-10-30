import { describe, expect, it } from 'vitest'
import { nameOf } from './name-of'

describe('a stored chat’s name while it opens', () => {
  const opening = 'Murmur QA test chat (safe to delete). For every message I send, reply'

  it('waits for the list rather than showing the opening words and then changing', () => {
    const shown = [
      nameOf({ live: '', opening, listing: true }),
      nameOf({ live: '', listed: 'Murmur QA test chat', opening, listing: false }),
    ].filter(Boolean)
    expect(shown).toEqual(['Murmur QA test chat'])
  })

  it('goes by the opening words once the list is in without it', () => {
    expect(nameOf({ live: '', opening, listing: false })).toBe(opening)
  })

  it('takes a title said live over the list', () => {
    expect(nameOf({ live: 'Renamed', listed: 'Murmur QA test chat', opening, listing: true })).toBe('Renamed')
  })
})
