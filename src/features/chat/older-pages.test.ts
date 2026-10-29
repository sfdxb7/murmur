import { describe, expect, it } from 'vitest'
import { olderPageFollow } from './older-pages'

describe('older pages while parked at the top', () => {
  it('asks again after each page lands, with no further scroll', () => {
    const follow = olderPageFollow()
    // Opens at the bottom. Two messages are on screen; nothing older is asked for.
    expect(follow.onLayout({ scrollTop: 800, scrollHeight: 1000, topId: 'page-0', atBottom: true })).toEqual({
      scrollTop: 800,
      ask: false,
    })
    expect(follow.onScroll(800)).toBe(false)

    // One gesture to the top.
    expect(follow.onScroll(0)).toBe(true)

    // The first older page lands (2 messages become 4). scrollTop never moved, so there is no scroll event.
    const first = follow.onLayout({ scrollTop: 0, scrollHeight: 1800, topId: 'page-1', atBottom: false })
    expect(first).toEqual({ scrollTop: 0, ask: true })

    // Still parked. The next page has to be asked for on its own.
    const second = follow.onLayout({ scrollTop: first.scrollTop, scrollHeight: 2600, topId: 'page-2', atBottom: false })
    expect(second).toEqual({ scrollTop: 0, ask: true })

    const third = follow.onLayout({ scrollTop: 0, scrollHeight: 3400, topId: 'page-3', atBottom: false })
    expect(third.ask).toBe(true)
  })

  it('pins back to the top when the layout still has the offset from the bottom', () => {
    const follow = olderPageFollow()
    follow.onLayout({ scrollTop: 800, scrollHeight: 1000, topId: 'page-0', atBottom: true })
    follow.onScroll(800)
    follow.onScroll(0)
    // The render that paints the page can still be holding the pre-scroll offset.
    const landed = follow.onLayout({ scrollTop: 800, scrollHeight: 1800, topId: 'page-1', atBottom: false })
    expect(landed).toEqual({ scrollTop: 0, ask: true })
  })

  it('keeps a reader in the middle where they were, and does not keep paging', () => {
    const follow = olderPageFollow()
    follow.onLayout({ scrollTop: 800, scrollHeight: 1000, topId: 'page-0', atBottom: true })
    follow.onScroll(800)
    expect(follow.onScroll(400)).toBe(false)
    const landed = follow.onLayout({ scrollTop: 400, scrollHeight: 1800, topId: 'page-1', atBottom: false })
    expect(landed).toEqual({ scrollTop: 1200, ask: false })
  })
})
