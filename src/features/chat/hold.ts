// Deciding whether a press is a long-press on a message, or something else
// (a scroll, a link, a selection). Kept apart from the hook so it can be tested
// without a browser.

export const HOLD_MS = 420
/** If a long-press never produces a context menu, the Copy button appears after this, while the finger is still down. */
export const HOLD_FALLBACK_MS = 800
export const HOLD_SLOP = 8

/** A link, button or field nested in a message. A press on one is its own. */
export const HOLD_CONTROL = 'a, button, input, textarea, select, [role="button"]'

/** A touch or pen that isn't already on a control can become a long-press. A mouse never does: it selects. */
export function pointerStartsHold(pointerType: string, onControl: boolean) {
  return pointerType !== 'mouse' && !onControl
}

/** The finger moved enough that this is a scroll or a drag, not a hold. */
export function holdMoved(dx: number, dy: number, slop = HOLD_SLOP) {
  return dx * dx + dy * dy > slop * slop
}

/**
 * True when the event landed on a control inside the host. The host itself may
 * be a button (a chat's title); that press still belongs to the host.
 */
export function controlInside(target: EventTarget | null, host: EventTarget | null) {
  if (!target || target === host) return false
  const closest = (target as { closest?: (selector: string) => EventTarget | null }).closest
  if (typeof closest !== 'function') return false
  const hit = closest.call(target, HOLD_CONTROL)
  return !!hit && hit !== host
}

export type ContextMenuAction = 'ignore' | 'open' | 'copy'

/**
 * What the context menu event should do.
 * A mouse right-click on a selection stays with the browser, so those words can
 * be copied as selected. A touch long-press on a copyable message copies it
 * (that event is still a user gesture, which is what iOS needs to allow the
 * clipboard). A mouse right-click with nothing selected opens the menu, and so
 * does any other hold.
 */
export function contextMenuAction(input: {
  /** This hold copies on a touch long-press. A right-click still opens the menu. */
  copies: boolean
  fromTouch: boolean
  onControl: boolean
  /** Right-click while some of this message is selected. */
  rightClickOnSelection: boolean
}): ContextMenuAction {
  if (input.onControl || input.rightClickOnSelection) return 'ignore'
  if (input.copies && input.fromTouch) return 'copy'
  return 'open'
}
