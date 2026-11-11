import { beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseExpanded, rememberedOpen, setExpanded } from './expanded'

const KEY = 'murmur:sidebar-open'
const kept = new Map<string, string>()

beforeEach(() => {
  kept.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    clear: () => kept.clear(),
  })
})

describe('which sidebar rows stay open', () => {
  it('forgets a collapse when the row is selected, and keeps an explicit open', () => {
    setExpanded('scout', false)
    setExpanded('keeper', true)
    expect(rememberedOpen('scout')).toBe(false)

    releaseExpanded('scout')
    releaseExpanded('keeper')

    expect(rememberedOpen('scout')).toBeUndefined()
    expect(rememberedOpen('keeper')).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ keeper: true })
  })

  it('does nothing when the row was never folded', () => {
    releaseExpanded('scout')
    expect(rememberedOpen('scout')).toBeUndefined()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
