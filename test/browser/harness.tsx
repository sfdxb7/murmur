import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Thread } from '@/features/chat/thread'
import type { ChatItem } from '@/features/chat/types'
import { loadOlder, openChat, useChats } from '@/state/chats'
import '@/styles.css'

const NONE: ChatItem[] = []

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

/** A long stored chat. The Playwright test answers its message reads. */
export const SESSION = 'sess-long'
const PROFILE = 'browser'

function Harness() {
  const items = useChats((s) => s.chats[SESSION]?.items ?? NONE)
  const olderHidden = useChats((s) => s.chats[SESSION]?.olderHidden)
  useEffect(() => {
    void openChat(SESSION, PROFILE)
  }, [])
  return (
    <div className="h-full">
      <Thread
        items={items}
        busy={false}
        media={{ sessionId: SESSION, profile: PROFILE }}
        onLoadOlder={() => loadOlder(SESSION)}
        olderHidden={olderHidden}
        onApprove={() => {}}
        onAnswer={() => {}}
      />
    </div>
  )
}

declare global {
  interface Window {
    __loadOlder?: () => Promise<boolean>
  }
}

window.__loadOlder = () => loadOlder(SESSION)

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <Harness />
  </QueryClientProvider>,
)
