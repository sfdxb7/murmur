import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { scoped } from '@/hermes/instance'
import { forgetUnsent, unsentText } from '@/state/chats'

// What every message box shares: unsent text that survives a reload, and a
// field that grows with what's typed.

const PREFIX = scoped('murmur:draft:')

function readDraft(key?: string) {
  if (!key) return ''
  try {
    const draft = localStorage.getItem(PREFIX + key)
    if (draft != null) return draft
    // A message still waiting to send when the page went away comes back as the draft.
    const unsent = unsentText(key)
    if (unsent) {
      writeDraft(key, unsent)
      forgetUnsent(key)
    }
    return unsent
  } catch {
    return ''
  }
}

function writeDraft(key: string, text: string) {
  try {
    if (text) localStorage.setItem(PREFIX + key, text)
    else localStorage.removeItem(PREFIX + key)
  } catch {
    /* storage unavailable: drafts just don't persist */
  }
}

/** Unsent text, kept per key (a chat, a group) across reloads. `clear` forgets it at once. */
export function useDraft(key?: string) {
  const [text, setText] = useState(() => readDraft(key))
  const [shown, setShown] = useState(key)
  if (shown !== key) {
    setShown(key)
    setText(readDraft(key))
  }
  // Written a beat after typing stops; leaving the chat or the page writes what's still waiting.
  const pending = useRef<{ key: string; text: string } | null>(null)
  const flush = useRef(() => {
    const p = pending.current
    pending.current = null
    if (p) writeDraft(p.key, p.text)
  }).current
  useEffect(() => {
    if (!key) return
    pending.current = { key, text }
    const t = window.setTimeout(flush, 250)
    return () => window.clearTimeout(t)
  }, [key, text, flush])
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [key, flush])
  const clear = useCallback(() => {
    pending.current = null
    setText('')
    if (key) writeDraft(key, '')
  }, [key])
  return [text, setText, clear] as const
}

const MAX_LINES = 8
const LINE = 24

/** Grow a textarea with its text, 1 → 8 lines, then scroll. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, text: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    let tries = 0
    const fit = () => {
      // Not laid out yet (a screen still arriving): keep its natural one line,
      // and measure once it's there, rather than collapse it and grow a beat later.
      if (!el.getClientRects().length) {
        el.style.height = ''
        if (tries++ < 30) frame = requestAnimationFrame(fit)
        return
      }
      // (Measured at no height: no transition may catch that, not even reduced
      // motion's 1ms one, or the field shows collapsed for a frame.)
      el.style.setProperty('transition', 'none', 'important')
      el.style.height = '0px'
      const style = getComputedStyle(el)
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const content = el.scrollHeight - pad
      const max = MAX_LINES * LINE
      el.style.height = `${pad + Math.min(content, max)}px`
      el.style.overflowY = content > max ? 'auto' : 'hidden'
    }
    fit()
    return () => cancelAnimationFrame(frame)
  }, [ref, text])
}
