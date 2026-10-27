# memory

## Overview

What an agent remembers. A row on the agent sheet opens a sheet for viewing, editing and forgetting memories, and for telling the agent something to remember. Data and actions come from `src/state/memory.ts`.

## Interface

- `index.ts` re-exports `MemoryRow`, `RowIcon`, `MemorySheet`, and `rememberMessage` from `src/state/memory.ts`.
- `memory-row.tsx`: `MemoryRow` (for example "Memory · Remembers 7 things") and `RowIcon`. Place it in a `ListGroup`. It opens `MemorySheet` through `onOpen`.
- `memory-sheet.tsx`: `MemorySheet`.

## Invariants

- All reads and writes go through `useMemories`, `useMemoryActions` and `fullMemoryText` from `src/state/memory.ts`.
- After you ask the agent to remember something, the sheet keeps checking for up to 45 s (`WATCH_MS`) until the agent has saved it.

## Side Effects

- The memory actions (`edit`, `forget` and `forgetAll`) change the agent's memory on Hermes.
- `MemorySheet` refetches memories, calls `navigator.vibrate`, and adds a capturing `keydown` listener while it is open.

## Verification

- Run: `npm test`
