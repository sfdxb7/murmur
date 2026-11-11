import { create } from 'zustand'

// Which agents show their chats beneath them in the sidebar. The agent you're
// in opens on its own; anything you open or close yourself is remembered.

const KEY = 'murmur:sidebar-open'

function load(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

const useStore = create<{ open: Record<string, boolean> }>(() => ({ open: load() }))

/** Whether `id` is expanded: your choice, else open while it's the agent you're in. */
export const useExpanded = (id: string, active: boolean) => useStore((s) => s.open[id] ?? active)

/** The choice stored for `id`, when someone set one. Absent means "open while it's selected". */
export const rememberedOpen = (id: string) => useStore.getState().open[id]

export function setExpanded(id: string, open: boolean) {
  useStore.setState((s) => {
    const next = { ...s.open, [id]: open }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Private mode: it lasts the visit.
    }
    return { open: next }
  })
}

/**
 * Forget a collapse, so the row opens again while it's the one you're in.
 * An explicit "keep open" stays. The chevron is what writes a choice; selecting
 * the row only clears a stored shut, otherwise a row you once folded never
 * opens when you come back to it.
 */
export function releaseExpanded(id: string) {
  useStore.setState((s) => {
    if (s.open[id] !== false) return s
    const next = { ...s.open }
    delete next[id]
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Private mode: it lasts the visit.
    }
    return { open: next }
  })
}
