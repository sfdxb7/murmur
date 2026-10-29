import { describe, expect, it } from 'vitest'
import { contextMenuAction, controlInside, holdMoved, pointerStartsHold } from './hold'

describe('a press on a message', () => {
  it('starts a hold for a touch or a pen on the words, never for a mouse', () => {
    expect(pointerStartsHold('touch', false)).toBe(true)
    expect(pointerStartsHold('pen', false)).toBe(true)
    expect(pointerStartsHold('mouse', false)).toBe(false)
  })

  it('leaves a link, a button or a field to itself', () => {
    expect(pointerStartsHold('touch', true)).toBe(false)
    const link = { closest: () => link }
    const host = { closest: () => null }
    expect(controlInside(link as unknown as EventTarget, host as unknown as EventTarget)).toBe(true)
    expect(controlInside(host as unknown as EventTarget, host as unknown as EventTarget)).toBe(false)
    expect(controlInside(null, host as unknown as EventTarget)).toBe(false)
  })

  it('gives up once the finger has moved, so a scroll stays a scroll', () => {
    expect(holdMoved(0, 0)).toBe(false)
    expect(holdMoved(8, 0)).toBe(false)
    expect(holdMoved(9, 0)).toBe(true)
    expect(holdMoved(0, -9)).toBe(true)
    expect(holdMoved(6, 6)).toBe(true)
  })
})

describe('the context menu', () => {
  const base = { copies: false, fromTouch: false, onControl: false, rightClickOnSelection: false }

  it('opens the menu for a right-click or a touch hold', () => {
    expect(contextMenuAction(base)).toBe('open')
    expect(contextMenuAction({ ...base, fromTouch: true })).toBe('open')
  })

  it('copies on a touch long-press, and opens the menu for a mouse right-click', () => {
    expect(contextMenuAction({ ...base, copies: true, fromTouch: true })).toBe('copy')
    expect(contextMenuAction({ ...base, copies: true, fromTouch: false })).toBe('open')
  })

  it('steps aside for a selected range, and for a control inside the message', () => {
    expect(contextMenuAction({ ...base, rightClickOnSelection: true })).toBe('ignore')
    expect(contextMenuAction({ ...base, copies: true, fromTouch: true, onControl: true })).toBe('ignore')
    expect(contextMenuAction({ ...base, copies: true, fromTouch: true, rightClickOnSelection: true })).toBe('ignore')
  })
})
