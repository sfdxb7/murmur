// Opening an agent asks for two dozen things at once, nearly all for its side
// panels (apps, models, memory, usage, routines). Browsers give a Murmur on
// plain HTTP six connections, and Hermes works through them all at the same
// time, so a person's chats ended up queued behind panels nobody was waiting
// on. Panels now go a few at a time, and let the chats go first. So does
// anything asked for with `priority: 'low'`, like a routine's past runs, which
// can be dozens at once.

const PANEL = /^\/api\/(mcp|messaging|learning|analytics|plugins|tools|env|model\/options|cron\/jobs)(\/|\?|$)/
const CHATS = /^\/api\/sessions(\/|\?|$)/
const PANEL_SLOTS = 3
/** However busy the chats are, panels aren't held longer than this. */
const HEAD_START = 1500

let chats = 0
let panels = 0
const waiting: { since: number; go: () => void }[] = []

function pump() {
  while (panels < PANEL_SLOTS && waiting.length && (chats === 0 || Date.now() - waiting[0].since >= HEAD_START)) {
    panels++
    waiting.shift()!.go()
  }
}

/**
 * Waits for this request's turn; call what it returns once it's done. Writes
 * always go at once, and so does anything on a deadline, which a wait here
 * would use up.
 */
export async function takeTurn(method: string, path: string, init?: RequestInit): Promise<() => void> {
  const low = init?.priority === 'low'
  if (method === 'GET' && !low && CHATS.test(path)) {
    chats++
    return () => {
      chats--
      pump()
    }
  }
  if (method !== 'GET' || init?.signal || !(low || PANEL.test(path))) return () => {}
  await new Promise<void>((go) => {
    waiting.push({ since: Date.now(), go })
    // A beat first: the chats asked for in the same render may not have registered yet.
    setTimeout(pump, 0)
    setTimeout(pump, HEAD_START)
  })
  return () => {
    panels--
    pump()
  }
}
