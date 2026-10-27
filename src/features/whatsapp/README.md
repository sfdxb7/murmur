# whatsapp

## Overview

Texting an agent on WhatsApp. A sheet lets you link the agent, check on the link, or turn it off. State and actions come from `src/state/whatsapp.ts`.

## Interface

- `index.ts` re-exports `WhatsAppSheet` and `WhatsAppGlyph`.
- `whatsapp-sheet.tsx`: `WhatsAppSheet`.
- `whatsapp-glyph.tsx`: `WhatsAppGlyph`.

## Invariants

- Components use `useWhatsApp`, `useLinks`, `startLink`, `cancelLink`, `linkActive`, `chatLink`, `phoneLabel`, `disconnectWhatsApp` and `whatsappKey` from `src/state/whatsapp.ts`. They never call Hermes directly.
- The link mode is either `'self-chat'` or `'bot'` (`WhatsAppMode` in `src/state/whatsapp.ts`).

## Side Effects

- Linking and disconnecting change the agent's messaging configuration on Hermes through `src/state/whatsapp.ts`. This includes the onboarding endpoints, `profiles.configure`, and a gateway restart when needed.
- `WhatsAppSheet` calls `navigator.vibrate` when linking completes.

## Verification

- Run: `npm test`
