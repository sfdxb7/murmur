# telegram

## Overview

Texting an agent from Telegram. This covers the agent-sheet row and a sheet to set up, check on, or turn off the agent's Telegram bot. Pairing is done with a QR code. State and actions come from `src/state/telegram.ts`.

## Interface

- `index.ts` re-exports `TelegramRow`, `TelegramSheet`, `TelegramGlyph` and `QrCode`.
- `telegram-row.tsx`: `TelegramRow` (for example "Telegram · Connected as @atlas_bot"). Place it in a `ListGroup`. It opens `TelegramSheet` through `onOpen`.
- `telegram-sheet.tsx`: `TelegramSheet`.
- `qr-code.tsx`: `QrCode`, a QR code with rounded modules and a clear centre for the agent's orb.
- `telegram-glyph.tsx`: `TelegramGlyph`.

## Invariants

- `QrCode` always draws dark modules on white, even in dark mode, and uses high error correction so it still scans with the centre cut out.
- Components use `useTelegram`, `usePairing`, `startPairing`, `cancelPairing`, `clearPairing`, `pairingActive`, `disconnectTelegram`, `botLink` and `telegramKey` from `src/state/telegram.ts`. They never call Hermes directly.

## Side Effects

- Pairing and disconnecting change the agent's messaging configuration on Hermes. Through `src/state/telegram.ts`, this can include `profiles.configure`, `PUT` on messaging settings, and a gateway restart.
- `TelegramSheet` calls `navigator.vibrate` when pairing completes.

## Verification

- Run: `npm test`
