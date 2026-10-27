# notifications

## Overview

System notifications when an agent finishes, needs you, or a routine finds something while you are looking elsewhere. They use the web Notification API. The desktop app passes them to the OS, and desktop browsers show them on localhost or HTTPS.

## Interface

- `notifications.ts`:
  - Permission and settings: `notificationsSupported`, `useNotifications`, `isOn`, `shouldOffer` and `setNotifications`.
  - `watchPermission` and `showNote`.
- `compose.ts`: pure functions that write the notification text: `chatNote`, `runNote`, `groupNote`, `firstLine`, `chatHref` and the type `Note`.
- `routine-runs.ts`: `watchRoutineRuns`, `look`, `deliversElsewhere` and the types `RunRow`, `Memory` and `Found`.
- `notify.tsx`: `useSystemNotifications`, `NotificationOffer` and `NotificationsSetting`.

## Invariants

- Murmur asks once, in its own words, before the browser asks. Settings can turn notifications off.
- The on/off choice belongs to this device and applies to every Hermes.
- A routine run is reported only when it has something to say, using the same quiet-run rule Hermes uses before it delivers. Runs that already existed when watching started are never reported. Nothing is stored, so runs that finish while Murmur is closed wait on the agent's page.
- In the desktop app, permission always appears granted to the page, because the OS decides later.

## Side Effects

- `localStorage` key `murmur:notifications`.
- Calls `Notification.requestPermission()` and `new Notification(...)` with icon `/icon-192.png`.
- `routine-runs.ts` calls `GET /api/sessions?source=cron` and `GET /api/cron/jobs` for each agent. It re-checks on the gateway events `sessions.changed` and `cron.changed`, and when the gateway reopens.
- Uses `src/lib/desktop.ts` for desktop-app behaviour.

## Verification

- Run: `npm test` (tests in this directory: `compose.test.ts`, `routine-runs.test.ts`)
