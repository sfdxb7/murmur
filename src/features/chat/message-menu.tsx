import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { HOLD_FALLBACK_MS, HOLD_MS, contextMenuAction, controlInside, holdMoved, pointerStartsHold } from './hold'

// Press and hold a message (or right-click it) for what you can do with it.
// The bubble lifts above a soft scrim and a small menu settles beside it, the
// way iOS does it.

export type MenuAction = { label: string; icon: LucideIcon; onSelect: () => void }

type LongPressOptions = {
  /** A press that starts on a link, button or field inside is left alone. */
  ignoreControls?: boolean
  /**
   * Run this on a touch long-press, inside the contextmenu event, instead of
   * opening the menu. That event is still a user gesture, so iOS will allow
   * the clipboard; a timer is not. If the event never comes, the hold still
   * opens the menu so Copy is one tap away. A mouse right-click opens that menu
   * too, unless some of the message is already selected.
   */
  onGesture?: (target: HTMLElement) => void
}

/** Long-press (touch or pen) and right-click open the menu; a scroll or a drag cancels. */
export function useLongPress(onOpen: (target: HTMLElement) => void, options?: LongPressOptions) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const acted = useRef(false)
  const fromTouch = useRef(false)
  const moved = useRef(false)
  const opts = useRef(options)
  opts.current = options
  const cancel = () => {
    window.clearTimeout(timer.current)
    start.current = null
  }
  useEffect(() => cancel, [])

  const act = () => {
    if (acted.current) return false
    acted.current = true
    // Drop a selection the browser started, so its loupe doesn't sit on the menu.
    window.getSelection()?.removeAllRanges()
    navigator.vibrate?.(10)
    return true
  }

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      // A new gesture. A scroll in the previous one must not swallow this one.
      moved.current = false
      const onControl = !!opts.current?.ignoreControls && controlInside(e.target, e.currentTarget)
      if (!pointerStartsHold(e.pointerType, onControl)) {
        fromTouch.current = false
        return
      }
      fromTouch.current = true
      acted.current = false
      const target = e.currentTarget
      start.current = { x: e.clientX, y: e.clientY }
      // The copy itself runs in contextmenu (a gesture). This only opens the
      // menu if that event never arrives, and only while the finger is still down.
      const ms = opts.current?.onGesture ? HOLD_FALLBACK_MS : HOLD_MS
      timer.current = window.setTimeout(() => {
        start.current = null
        if (!act()) return
        onOpen(target)
      }, ms)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s || !holdMoved(e.clientX - s.x, e.clientY - s.y)) return
      // A scroll or a drag. Remember it, so the context menu that may follow
      // isn't treated as a hold.
      moved.current = true
      cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      if (moved.current) return
      const current = opts.current
      const sel = window.getSelection()
      const selected = !!sel && !sel.isCollapsed && !!sel.anchorNode && e.currentTarget.contains(sel.anchorNode)
      const action = contextMenuAction({
        copies: !!current?.onGesture,
        fromTouch: fromTouch.current,
        onControl: !!current?.ignoreControls && controlInside(e.target, e.currentTarget),
        rightClickOnSelection: e.button === 2 && selected,
      })
      if (action === 'ignore') return
      e.preventDefault()
      cancel()
      if (!act()) return
      if (action === 'copy') current?.onGesture?.(e.currentTarget)
      else onOpen(e.currentTarget)
    },
  }
}

const spring = { type: 'spring', duration: 0.34, bounce: 0.18 } as const
const out = { duration: 0.16, ease: [0.16, 1, 0.3, 1] } as const

/**
 * The lifted bubble and its menu. `anchor` is the bubble that was pressed;
 * `bubble` re-draws it above the scrim.
 */
export function MessageMenu({
  anchor,
  bubble,
  actions,
  onClose,
}: {
  anchor: HTMLElement | null
  bubble: ReactNode
  actions: MenuAction[]
  onClose: () => void
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  // The portal leaves the chat's colour behind; carry the agent's hue along.
  const [hue, setHue] = useState('')
  const menu = useRef<HTMLDivElement>(null)
  const [menuHeight, setMenuHeight] = useState(actions.length * 48 + 12)

  useLayoutEffect(() => {
    if (!anchor) return
    setRect(anchor.getBoundingClientRect())
    setHue(getComputedStyle(anchor).getPropertyValue('--hue').trim())
  }, [anchor])
  useLayoutEffect(() => {
    if (menu.current) setMenuHeight(menu.current.offsetHeight)
  }, [rect])

  useEffect(() => {
    if (!anchor) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  // Below the bubble if it fits, else above it; nudged on screen either way.
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const below = rect ? rect.bottom + 8 + menuHeight < vh - 16 : true
  const top = rect ? (below ? rect.bottom + 8 : Math.max(16, rect.top - 8 - menuHeight)) : 0
  const right = rect ? Math.max(12, window.innerWidth - rect.right) : 0
  const open = !!anchor

  return createPortal(
    <AnimatePresence onExitComplete={() => setRect(null)}>
      {open && rect && (
        <div key="menu" className="hue-scope fixed inset-0 z-50" style={hue ? ({ '--hue': hue } as CSSProperties) : undefined}>
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.24 } }}
            exit={{ opacity: 0, transition: out }}
            onClick={onClose}
          />
          {/* The bubble, lifted. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute flex justify-end"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              transformOrigin: below ? '100% 100%' : '100% 0%',
            }}
            initial={{ scale: 1 }}
            animate={{ scale: 1.03, transition: spring }}
            exit={{ scale: 1, transition: out }}
          >
            {bubble}
          </motion.div>
          <motion.div
            ref={menu}
            role="menu"
            className="absolute min-w-48 overflow-hidden rounded-[18px] bg-elevated/95 p-1.5 shadow-float ring-[0.5px] ring-line-strong backdrop-blur-xl"
            style={{ top, right, transformOrigin: below ? '100% 0%' : '100% 100%' }}
            initial={{ opacity: 0, scale: 0.92, y: below ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: spring }}
            exit={{ opacity: 0, scale: 0.96, transition: out }}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose()
                  a.onSelect()
                }}
                className={cn(
                  'flex h-11 w-full items-center justify-between gap-6 rounded-[12px] px-3 text-left text-body text-ink outline-none',
                  'hover:bg-fill-2 focus-visible:bg-fill-2 active:bg-fill-3',
                )}
              >
                {a.label}
                <a.icon size={18} strokeWidth={1.85} className="text-ink-2" aria-hidden />
              </button>
            ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
