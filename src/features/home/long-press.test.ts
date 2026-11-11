import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLongPress, HOLD_MS, MOVE_PX } from './long-press'

const pointer = (type: string, x: number, y: number, id = 1) => ({
  pointerType: type,
  pointerId: id,
  clientX: x,
  clientY: y,
})

const click = () => ({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
const context = (x = 0, y = 0) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  clientX: x,
  clientY: y,
})

const listeners = new Map<string, Set<(e: Event) => void>>()

function installWindow() {
  listeners.clear()
  const add = (type: string, fn: (e: Event) => void) => {
    const set = listeners.get(type) ?? new Set()
    set.add(fn)
    listeners.set(type, set)
  }
  const remove = (type: string, fn: (e: Event) => void) => listeners.get(type)?.delete(fn)
  const dispatch = (e: Event) => {
    listeners.get(e.type)?.forEach((fn) => fn(e))
    return true
  }
  vi.stubGlobal('window', { addEventListener: add, removeEventListener: remove, dispatchEvent: dispatch })
  vi.stubGlobal('document', { addEventListener: add, removeEventListener: remove })
  vi.stubGlobal('navigator', { vibrate: vi.fn() })
}

describe('a hold on a row', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    installWindow()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens the menu after half a second on a still touch', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 12, 40))
    vi.advanceTimersByTime(HOLD_MS - 1)
    expect(opened).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(opened).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('does not start a hold from a mouse, and opens on right-click where it was', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('mouse', 20, 30))
    vi.advanceTimersByTime(HOLD_MS + 50)
    expect(opened).not.toHaveBeenCalled()
    const ev = context(20, 30)
    handlers.onContextMenu(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(opened).toHaveBeenCalledTimes(1)
    expect(opened).toHaveBeenCalledWith({ x: 20, y: 30 })
    dispose()
  })

  it('lets go if the finger moves or the page scrolls before the hold', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 0, 0))
    handlers.onPointerMove(pointer('touch', MOVE_PX + 1, 0))
    vi.advanceTimersByTime(HOLD_MS + 50)
    expect(opened).not.toHaveBeenCalled()

    handlers.onPointerDown(pointer('touch', 0, 0))
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(HOLD_MS + 50)
    expect(opened).not.toHaveBeenCalled()
    dispose()
  })

  it('does not take a jitter smaller than the slop as a move', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 0, 0))
    handlers.onPointerMove(pointer('touch', MOVE_PX - 1, 0))
    vi.advanceTimersByTime(HOLD_MS)
    expect(opened).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('opens once when the timer and a native contextmenu both fire', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 8, 8))
    vi.advanceTimersByTime(HOLD_MS)
    const ev = context(8, 8)
    handlers.onContextMenu(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(opened).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('stops the click that ends a hold from following the row', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 0, 0))
    vi.advanceTimersByTime(HOLD_MS)
    handlers.onPointerUp()
    const ev = click()
    handlers.onClick(ev)
    expect(ev.preventDefault).toHaveBeenCalled()
    expect(ev.stopPropagation).toHaveBeenCalled()
    const next = click()
    handlers.onClick(next)
    expect(next.preventDefault).not.toHaveBeenCalled()
    dispose()
  })

  it('lets go when a second finger lands mid-hold', () => {
    const opened = vi.fn()
    const { handlers, dispose } = createLongPress(opened)
    handlers.onPointerDown(pointer('touch', 0, 0, 1))
    handlers.onPointerDown(pointer('touch', 4, 4, 2))
    vi.advanceTimersByTime(HOLD_MS + 50)
    expect(opened).not.toHaveBeenCalled()
    dispose()
  })
})
