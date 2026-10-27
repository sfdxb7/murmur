# chat-screen

## Overview

The parts around a chat's thread: header, chat menu, context and cost sheet, empty and not-found states, the goal chip, file drop target, and signals about activity elsewhere in the app. The thread and composer are in [../chat/README.md](../chat/README.md).

## Interface

- `chat-header.tsx`: `ChatHeader`.
- `chat-menu.tsx`: `ChatMenu`, `ChatMenuButton` and `useChatMenu`. The menu can copy or share the chat, open info, and pin, rename, archive or delete it.
- `chat-info.tsx`: `ChatInfoSheet` and `ContextRing`, which show how full the context is and what the chat has cost.
- `chat-name.ts`: `useChatName`, which waits briefly for Hermes's title after the first reply.
- `transcript.ts`: `transcript(...)`, the chat as plain markdown with each step folded to one line.
- `relative-day.ts`: `relativeDay(date)`, which gives "14:05", "Yesterday", a weekday name, or "12 Oct".
- `use-orb-state.ts`: `useOrbState`, the header orb's mood (done, watching the composer, speaking).
- `elsewhere.tsx`: `useElsewhere`, `BackBadge` and `backHint`. These show the count of unread chats on the back chevron, an amber dot when an agent needs you, and a toast when another agent starts waiting.
- `drop-zone.tsx`: `DropZone`, which passes dropped files to the composer.
- `goal-chip.tsx`: `GoalChip`, the agent's `/goal` pinned under the header with pause and clear.
- `hearts.tsx`: `Hearts` and `useLoved`, small hearts shown when you thank the agent.
- `empty-state.tsx`: `EmptyState`. `not-found.tsx`: `NotFound`. `thread-skeleton.tsx`: `ThreadSkeleton`.

## Invariants

- The context ring shows in the composer only when the context is more than half full (`contextWorthShowing`). The chat menu always offers the full sheet.
- `chat-menu.tsx` shows Share only where `navigator.share` exists.
- Chat data comes from `src/state/chats.ts`, `src/state/agents.ts`, `src/state/groups.ts`, `src/state/routines.ts`, `src/state/status.ts` and `src/state/insights.ts`. Nothing here calls Hermes directly.

## Side Effects

- `chat-menu.tsx` writes to the clipboard, calls `navigator.share`, and adds a `keydown` listener while it is open.
- `DropZone` listens to window drag-and-drop events.

## Verification

- Run: `npm test`
