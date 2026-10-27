# access

## Overview

UI for messaging-platform access requests: people on Telegram, WhatsApp and similar platforms who want to message an agent, and the people an agent already answers there. Data and actions come from `src/state/access.ts`.

## Interface

- `index.ts` re-exports `RequestCard`, `People` and `PlatformGlyph`.
- `request-card.tsx`: `RequestCard`, a "Sam wants to message Atlas" card for Needs you. Allow lets the person in with one tap. Afterwards the card shows a short receipt and then goes away. The cross dismisses the request.
- `people.tsx`: `People`, the list of pending requesters and allowed people for one platform's sheet.
- `platform-glyph.tsx`: `PlatformGlyph`, a small badge for the platform a person wrote from.

## Invariants

- `People` renders nothing when there are no pending requests and no allowed people.
- `PlatformGlyph` renders nothing for a platform that Murmur has no mark for.
- Components never call Hermes directly. They use `useAccess`, `useJustAllowed`, `allowRequest`, `ignoreRequest`, `removeAllowed` and `personName` from `src/state/access.ts`.

## Side Effects

- Allow, ignore and remove call the `src/state/access.ts` actions, which change the agent's access list on Hermes.
- `RequestCard` calls `navigator.vibrate` (when available) as tap feedback.

## Verification

- Run: `npm test`
