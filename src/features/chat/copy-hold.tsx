import { useCallback, useState, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { copyMessage } from './copy-message'
import { MessageMenu, useLongPress } from './message-menu'

// On a phone, hold a reply to copy it. The copy runs in the long-press's
// contextmenu event (still a tap, so iOS allows the clipboard) and a small
// "Copied" toast confirms it. If that event never arrives, the hold opens
// Copy instead. On a desktop, right-click opens Copy unless some words are
// already selected, and the hover Copy button is always there.

// Same treatment as your own bubble: no iOS callout or loupe on a hold.
// A mouse (fine pointer) can still select the words.
const heldText = '[-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none'

export function CopyHold({ text, children }: { text?: string; children: ReactNode }) {
  const [held, setHeld] = useState<HTMLElement | null>(null)
  const close = useCallback(() => setHeld(null), [])
  const copy = useCallback(() => void copyMessage(text ?? ''), [text])
  const press = useLongPress(setHeld, { ignoreControls: true, onGesture: text ? copy : undefined })

  return (
    <>
      <div {...(text ? press : undefined)} className={text ? heldText : undefined}>
        {children}
      </div>
      {text && (
        <MessageMenu
          anchor={held}
          onClose={close}
          actions={[{ label: 'Copy', icon: Copy, onSelect: copy }]}
          bubble={null}
        />
      )}
    </>
  )
}
