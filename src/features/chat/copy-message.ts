import { toast } from 'sonner'
import { proseOf } from '@shared/message.ts'
import { copyText } from './use-copy'

/**
 * The words to put on the clipboard: the message's markdown, with the file and
 * widget tags lifted out (the same text the Copy button uses).
 *
 * Markdown is the useful copy. The rendered text would drop link addresses,
 * list structure and code fences; the raw reply would keep `MEDIA:` paths the
 * screen already shows as files. What's left is what you'd paste into a note
 * or back to the agent.
 */
export function clipboardText(parts: readonly string[]) {
  return parts
    .map((part) => proseOf(part).trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Copy a message and say so. Resolves false when the clipboard refuses. */
export async function copyMessage(text: string) {
  if (!text) return false
  if (await copyText(text)) {
    toast.success('Copied', { duration: 1600 })
    return true
  }
  toast.error('Couldn’t copy that.')
  return false
}
