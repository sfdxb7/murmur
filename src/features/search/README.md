# search

## Overview

Search UI for chats: the search field and the results list. The search query and its results come from `src/state/search.ts`, and these components receive them through props.

## Interface

- `search-field.tsx`: `SearchField`, a rounded field with a magnifier icon and a clear button. It shows a spinner while results load.
- `search-results.tsx`:
  - `SearchResults({ search, text, density, activeIndex?, selectedChatId?, onOpen, className? })`.
  - `useResultKeys(results, open)`, which returns the active index and an `onKeyDown` handler for the input (Up and Down move, Enter opens). The active index resets when the results change.
  - `resultHref(r)`, which returns `/chat/<agentId>/<chatId>`.
  - The type `Density` (`'roomy' | 'compact'`).

## Invariants

- Each chat has one row, newest first. The orb shows whose chat it is, and matching words are highlighted in that agent's colour.
- While the typed text is shorter than `MIN_QUERY` (from `src/state/search.ts`), `SearchResults` shows no results list.

## Side Effects

- None. These components only render. They do not add global listeners or make network calls.

## Verification

- Run: `npm test`
