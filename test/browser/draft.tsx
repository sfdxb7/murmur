import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useDraft } from '@/features/chat/use-draft'

// A message box per chat, and a way to switch chats, for use-draft.ts.

function Box({ chat }: { chat: string }) {
  const [text, setText] = useDraft(chat)
  return <textarea aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} />
}

function Harness() {
  const [chat, setChat] = useState('a')
  return (
    <>
      <p>chat {chat}</p>
      <button onClick={() => setChat(chat === 'a' ? 'b' : 'a')}>Switch</button>
      <Box key={chat} chat={chat} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
