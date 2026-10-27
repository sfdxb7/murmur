# voice

## Overview

Voice in and voice out. Dictation records speech and has Hermes turn it into text for the composer. Read-aloud has Hermes speak a reply using the agent's own voice settings.

## Interface

- `dictation.tsx`:
  - `canDictate` and `useDictation`.
  - Components: `Dictation`, `MicButton`, `DictationPanel` and `DictationNote`.
- `speech.ts`: `useSpeech` (a zustand store with `key`, `profile` and `phase`), `toggleSpeaking(key, text, profile)` and `stopSpeaking()`.

## Invariants

- Dictated text goes into the composer to be checked before sending. Nothing is sent automatically.
- The microphone is available only on secure pages (HTTPS or localhost). Over plain HTTP, `canDictate` is false.
- A recording stops itself after 2 minutes (`MAX_MS`).
- Only one voice plays at a time across the app. Starting a reply stops whatever was playing. Pausing from outside the app, such as from headphones or the lock screen, counts as a stop.
- Long replies are spoken in chunks. The next chunk is fetched while the current one plays.

## Side Effects

- `dictation.tsx` calls `navigator.mediaDevices.getUserMedia` and posts the recording to `/api/audio/transcribe`. While the panel is open, it adds a capturing `keydown` listener.
- `speech.ts` posts text to `/api/audio/speak` and plays the returned audio.

## Verification

- Run: `npm test`
