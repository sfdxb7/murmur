/**
 * Touch-and-hold for a row's menu. Pointer events cover phones whose browsers
 * never fire `contextmenu` on a long press (iOS Safari), and phones that do
 * (Android Chrome) without opening the menu twice — the timer and the native
 * menu would both fire around half a second. A move, a scroll, a second finger
 * or the pointer cancelling lets go; the click that ends a hold is swallowed
 * so the row isn't followed.
 */

export const HOLD_MS = 500
/** Chromium on Android jitters a stationary finger; 8px was cancelling holds. */
export const MOVE_PX = 10
/** iOS can deliver the click that ends a hold a few hundred milliseconds later. */
const CLICK_GRACE_MS = 500

export type LongPressAt = { x: number; y: number }

type PointerLike = {
  pointerType: string
  pointerId: number
  clientX: number
  clientY: number
}

type ClickLike = {
  preventDefault(): void
  stopPropagation(): void
}

type ContextLike = ClickLike & { clientX: number; clientY: number }

export type LongPressHandlers = {
  onPointerDown: (e: PointerLike) => void
  onPointerMove: (e: PointerLike) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClick: (e: ClickLike) => void
  onContextMenu: (e: ContextLike) => void
}

export function createLongPress(onLongPress: (at?: LongPressAt) => void, ms = HOLD_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let origin: LongPressAt | undefined
  let fired = false
  let mouse = false
  let pointerId: number | undefined
  let stopListening: (() => void) | undefined
  let stopEating: (() => void) | undefined

  const listening =
    typeof window !== 'undefined'
      ? {
          add: (type: string, fn: EventListener, capture = true) =>
            window.addEventListener(type, fn, { capture, passive: true }),
          remove: (type: string, fn: EventListener, capture = true) =>
            window.removeEventListener(type, fn, { capture }),
        }
      : { add: () => {}, remove: () => {} }

  const onScroll = () => cancel()
  const onTouchMove = (e: Event) => {
    const t = (e as TouchEvent).touches?.[0]
    if (!origin || !t) return
    if (Math.hypot(t.clientX - origin.x, t.clientY - origin.y) > MOVE_PX) cancel()
  }

  const arm = () => {
    stopListening?.()
    listening.add('scroll', onScroll)
    listening.add('touchmove', onTouchMove)
    stopListening = () => {
      listening.remove('scroll', onScroll)
      listening.remove('touchmove', onTouchMove)
      stopListening = undefined
    }
  }

  const disarm = () => {
    clearTimeout(timer)
    timer = undefined
    origin = undefined
    pointerId = undefined
    stopListening?.()
  }

  const cancel = () => disarm()

  const eatClick = () => {
    if (typeof document === 'undefined') return
    stopEating?.()
    const eat = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    document.addEventListener('click', eat, true)
    document.addEventListener('auxclick', eat, true)
    const timeout = setTimeout(stop, CLICK_GRACE_MS)
    function stop() {
      clearTimeout(timeout)
      document.removeEventListener('click', eat, true)
      document.removeEventListener('auxclick', eat, true)
      stopEating = undefined
    }
    stopEating = stop
  }

  const fire = (at?: LongPressAt) => {
    if (fired) return
    fired = true
    disarm()
    eatClick()
    if (typeof navigator !== 'undefined') navigator.vibrate?.(8)
    onLongPress(at)
  }

  const handlers: LongPressHandlers = {
    onPointerDown: (e) => {
      fired = false
      mouse = e.pointerType === 'mouse'
      if (mouse) return
      // A second finger, or another pointer mid-hold, is a gesture of its own.
      if (pointerId != null && e.pointerId !== pointerId) return cancel()
      pointerId = e.pointerId
      origin = { x: e.clientX, y: e.clientY }
      arm()
      timer = setTimeout(() => fire(), ms)
    },
    onPointerMove: (e) => {
      if (pointerId != null && e.pointerId !== pointerId) return
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > MOVE_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClick: (e) => {
      if (!fired) return
      e.preventDefault()
      e.stopPropagation()
      fired = false
      stopEating?.()
    },
    onContextMenu: (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (fired) return
      const at = mouse && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : undefined
      fire(at)
    },
  }

  return {
    handlers,
    dispose: () => {
      disarm()
      stopEating?.()
    },
  }
}
