import { describe, expect, it } from 'vitest'
import { canOpenWork, summary, workShowsResults, workStartsOpen, type ToolItem, type WorkItem } from './work'

const tool = (id: string, status: ToolItem['status'] = 'done', extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id,
  name: 'web_search',
  label: 'Searching the web',
  detail: 'murmur',
  status,
  startedAt: 1_000,
  endedAt: status === 'running' ? undefined : 3_000,
  ...extra,
})

const thought = (id: string, text = ''): WorkItem => ({
  kind: 'thinking',
  id,
  text,
  streaming: false,
  startedAt: 1,
})

describe('a stretch of work', () => {
  it('starts folded, and only opens into its steps or results when there is more to see', () => {
    expect(canOpenWork([tool('t1')])).toBe(false)
    expect(canOpenWork([tool('t1')], true)).toBe(true)
    expect(canOpenWork([tool('t1'), tool('t2')])).toBe(true)
    expect(canOpenWork([thought('th')])).toBe(false)
    expect(canOpenWork([thought('th', 'Considering the files…')])).toBe(true)
    expect(workStartsOpen([tool('t1')], false)).toBe(false)
    expect(workStartsOpen([tool('t1', 'error')], false)).toBe(false)
    expect(workStartsOpen([tool('t1', 'error')], false, true)).toBe(true)
    expect(workStartsOpen([tool('t1'), tool('t2', 'error')], false)).toBe(true)
    expect(workStartsOpen([tool('t1', 'error')], true)).toBe(false)
  })

  it('flags a failed stretch on the one-line summary', () => {
    expect(summary([tool('t1', 'error')])).toBe('Searched the web · murmur · Didn’t finish')
    const many = summary([tool('t1'), tool('t2', 'error', { name: 'terminal', label: 'Running a command' })])
    expect(many).toMatch(/Didn’t finish$/)
  })

  it('does not mount results for a finished, folded stretch, and does while it is live or opened', () => {
    expect(workShowsResults(false, false)).toBe(false)
    expect(workShowsResults(true, false)).toBe(true)
    expect(workShowsResults(false, true)).toBe(true)
  })
})

describe('a builder chat’s work, folded vs opened', () => {
  it('keeps heavy result views unmounted until the stretch is opened', () => {
    // A long coding turn: many steps, several of which produced pictures or screens.
    const steps: WorkItem[] = []
    let resultViews = 0
    for (let i = 0; i < 40; i++) {
      const hasMedia = i % 4 === 0
      const hasShot = i % 5 === 0
      steps.push(
        tool(`t${i}`, i === 39 ? 'error' : 'done', {
          name: hasShot ? 'computer_screenshot' : 'terminal',
          label: hasShot ? 'Looking at the screen' : 'Running a command',
          detail: `step ${i}`,
          media: hasMedia ? [`/tmp/out-${i}.png`] : undefined,
        }),
      )
      if (hasMedia) resultViews += 1
      if (hasShot) resultViews += 1
    }
    expect(canOpenWork(steps, resultViews > 0)).toBe(true)
    expect(workStartsOpen(steps, false)).toBe(true) // the last step failed: open, so it’s flagged in view
    const mountedIfFolded = workShowsResults(false, false) ? resultViews : 0
    const mountedIfOpened = workShowsResults(true, false) ? resultViews : 0
    expect(mountedIfFolded).toBe(0)
    expect(mountedIfOpened).toBe(resultViews)
    expect(mountedIfOpened).toBeGreaterThan(15)
    // eslint-disable-next-line no-console
    console.log(`work results mounted: folded=${mountedIfFolded} opened=${mountedIfOpened} (of ${steps.length} steps)`)
  })
})
