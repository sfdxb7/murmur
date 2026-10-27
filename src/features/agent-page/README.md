# agent-page

## Overview

Parts of an agent's own page and of the All agents gallery. This covers the hero, the quick-action tiles, the chat list with pin and archive actions, the weekly summary, the default-model sheet, and the iOS-style page bar with saved scroll position.

## Interface

- `chats.ts`: the agent's chat list data.
  - `useAgentChatList`: conversations plus one line per routine with a result, newest first, with pinned chats included.
  - `useArchivedChats`, `useUnread`.
  - `useChatActions`, which returns `ChatActions` (pin, archive, rename and delete).
  - Type `AgentChat`.
- `chat-list.tsx`: `ChatList`, `ChatOption` and `chatOptions`. Swipe right to pin a chat, swipe left to archive it, or touch and hold for the menu.
- `scroll.ts`: `usePageScroll`, which saves and restores scroll position on self-scrolling pages. It also reports when content has scrolled under the bar and when the large title has gone under it.
- `page-bar.tsx`: `PageBar`, a frosted bar with a back chevron on phones. Its small centred title takes over once the large title scrolls under.
- `hero.tsx`: `AgentHero` shows the agent's Buddy, name, purpose and model. Tapping the model opens `AgentModelSheet`.
- `model-sheet.tsx`: `AgentModelSheet`, which picks the model the agent uses for new chats.
- `quick-actions.tsx`: `QuickActions`, six tiles (Routines, Memory, Apps, Passwords, Telegram and WhatsApp), each showing its status, such as "2 on" or "1 waiting".
- `agent-card.tsx`: `AgentCard` and `NewAgentCard`, the tiles in the All agents gallery.
- `rename-chat.tsx`: `RenameChatSheet`.
- `week.tsx`: `WeekCard`, this week's chats, active days, monthly cost and most-used tools.

## Invariants

- Pins, archives and chat titles are stored by Hermes, so Hermes Desktop shows the same state. Chats are listed with `/api/sessions` and `exclude_sources=cron`. Routine runs are added from `src/state/routines.ts`.
- One routine shows as one line however many runs it has. Runs that found nothing never appear. If you reply in a run, that run becomes its own labelled chat.
- Pinned chats appear even when they are older than the list's window. Archived chats are listed separately.
- A chat name you set is never replaced by an agent-generated title. Names must be unique among one agent's chats (`titleTaken`).
- Changing the agent's default model affects new chats only. Existing chats keep their model.
- `WeekCard` renders nothing until there has been a chat this week.

## Side Effects

- Calls `GET /api/sessions` through `src/hermes/rest.ts` (`api`).
- Changes chats with `updateChat` and `deleteChat` from `src/state/chats.ts`.
- Reads agent, apps, memory, routines, vault, Telegram, WhatsApp, access, insights and status state through their `src/state/*` hooks.
- Calls `navigator.vibrate` during swipe gestures.

## Verification

- Run: `npm test`
