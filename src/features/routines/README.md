# routines

## Overview

Routines are things an agent does on its own, on a schedule. This feature covers the agent-sheet row, the list sheet, creating routines from Hermes blueprints or from scratch, routine details with past runs, recent results on the agent's page, and run views. Data comes from `src/state/routines.ts` and `src/state/timezone.ts`.

## Interface

- `index.ts` re-exports:
  - From this directory: `RoutinesRow`, `RoutinesSheet`, `NewRoutineSheet`, `RoutineDetailSheet`, `RoutineRunsList`, `RoutineNewsList`, `TimeWheel`, `RepeatPicker`, `DayChips`, `describeWhen`, `describeNext`, and the types `RoutinesSheetView` and `NewRoutineView`.
  - From `src/state/routines.ts`: `useRoutines`, `useRoutineRuns`, `useRoutineCount`, `useRoutineActions`, and the types `Routine` and `RoutineRun`.
  - From `src/state/timezone.ts`: `ensureTimezone` and `ensureAgentTimezone`.
- `schedule.ts`: converts between Hermes schedules (a cron line, an interval, or a single instant) and times and days.
  - Parsing and building: `parseSchedule`, `toSchedule`, `dayPreset`, `nextOccurrence`, `landsAt` and `isoInZone`.
  - Wording: `describeWhen`, `describeNext`, `describeDays` and `relativeDate`.
  - Formatting: `formatTime`, `hhmm`, `localIso`, `weekdayName`, `zoneLabel`, `capitalize`, `firstDayOfWeek` and `uses12Hour`.
  - Constants and types: `EVERY_DAY`, `WEEKDAYS`, `WEEKENDS`, `Days`, `When` and `RawSchedule`.
- `runs.ts`: `routineIdOf`, `runTitle`, `isRunBrief`, `isQuiet`, `isQuietExcerpt`, `foldQuiet`, `standingResults`, `resultLine` and the type `RunGroup`.
- `templates.ts`: `curate`, `toTemplate`, `tiles`, `tileFor`, `isHintOnly`, `iconFor`, `fieldLabel`, `optionLabel` and the types `Template`, `Tile` and `RoutineIcon`.
- Components:
  - `routine-item.tsx`: `RoutineItem`, `StatusLine` and `routineStatus`.
  - `run-view.tsx`: `useRunItems` and `RunHeader`.
  - `glyph.tsx`: `Glyph`.
  - `time-wheel.tsx`: `TimeWheel`.
  - `day-picker.tsx`: `DayChips` and `RepeatPicker`.
- `harness.tsx`: `RoutinesHarness`, a dev page that runs against a live Hermes (`/routines.html`).
- `routines.css`.

## Invariants

- Murmur shows schedules only as times and days, never as cron syntax.
- `0` is Sunday and `6` is Saturday, as in cron.
- A run is quiet when the agent answers with Hermes's silence marker. Murmur uses the same rule Hermes does, so quiet runs are the ones never delivered to Telegram. Quiet runs never appear among chats and never light up anything.
- Before Hermes 0.22.3, a run's chat id is `cron_<routine>_<yyyymmdd>_<hhmmss>`. From 0.22.3 on, only Hermes can say which routine a run belongs to (`runOf` in state).
- A run view hides Hermes's brief to the agent. Until a chat is known to be a run, it is treated as one, so the brief never flashes on screen.
- Blueprints Hermes adds later still appear, using Hermes's own wording.

## Side Effects

- Routine changes go through `useRoutineActions` in `src/state/routines.ts` (`createFromTemplate`, `createCustom`, `setEnabled`, `reschedule`, `rename`, `remove` and `runNow`), which change cron jobs on Hermes.
- `run-view.tsx` calls `GET /api/cron/jobs/<id>/runs` and `routine-detail.tsx` refetches results. `markChatSeen` updates unread state.
- `schedule.ts` reads `navigator.language` to choose the first day of the week and 12- or 24-hour time.

## Verification

- Run: `npm test` (tests in this directory: `runs.test.ts`)
