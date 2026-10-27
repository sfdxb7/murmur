# group

## Overview

Group chats, where several agents talk with you at once. This covers the group's composer with an @mention picker, its header, its empty state, the members sheet, and the row of members' Buddies. Group data comes from `src/state/groups.ts`.

## Interface

- `mentions.ts`: pure helpers for @mentions.
  - Conversion between names and handles: `toHandles` and `toNames`.
  - Finding mentions: `mentionRanges`, `mentionedIds` and `activeQuery`.
  - Types: `Mentionable` and `MentionRange`.
- `group-composer.tsx`: `GroupComposer`. Typing "@" opens a picker of faces, and chosen names are tinted in the agent's colour.
- `group-header.tsx`: `GroupHeader` and `subtitleFor`.
- `group-sheet.tsx`: `GroupSheet({ open, onOpenChange, group, onRename, onDelete, onOpenMember })`, which shows the members and lets you rename or delete the group through the callbacks.
- `group-empty.tsx`: `GroupEmpty`.
- `member-row.tsx`: `MemberRow`, the members' Buddies. The one speaking perks up, and mentioned members react.

## Invariants

- People write names ("@Atlas"). Hermes routes on handles ("@atlas", or "@hermes" for the main agent). Text is converted to handles on the way out and back to names on the way in, so users never see handles.

## Side Effects

- No network or storage access. Sending messages and changing groups go through the callbacks passed in by the screens that use these components.
- `GroupComposer` calls `haptic()` from `src/lib/haptics.ts`.

## Verification

- Run: `npm test`
