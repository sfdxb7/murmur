# model

## Overview

Choosing the model and thinking level a chat uses, and showing plan headroom. Model ids are shown to people with readable names.

## Interface

- `names.ts`:
  - `prettyModel(id)`: for example, "anthropic/claude-opus-5" becomes "Claude Opus 5".
  - `serviceName`, `thinkingOf` and `thinkingLabel`.
  - `THINKING_OPTIONS`, `EFFORT` and the type `Thinking`.
- `use-models.ts`:
  - `useModelOptions` and `freshenModels`.
  - `useThinkingDefault` and `useSetAgentDefault`.
  - Types: `ModelPick` and `ModelGroup`.
- `model-chip.tsx`: `ModelChip`, the composer chip (for example "GPT-6.1 Sol · Deep") that opens the sheet.
- `model-sheet.tsx`: `ModelSheet`.
- `plan.tsx`: `PlanGauge`, `Resting` and `ServiceHeading`, which show plan usage and when a service that hit its limit will be back.

## Invariants

- Raw model ids are never shown to people. `prettyModel` maps them to readable names.
- Hermes serves `/api/model/options` from a provider list cached for up to an hour. The first time each list is shown, Murmur also asks Hermes to refresh it (`refresh=true`) and then shows the result.
- When `/api/model/set` answers `confirm_required`, Murmur sends the request again with `confirm_expensive_model: true`.

## Side Effects

- Hermes REST: `GET /api/model/options` and `POST /api/model/set`.
- Gateway RPC: `config.get` and `config.set` for the `reasoning` key. `config.set` uses global scope.
- `ModelSheet` shows `sonner` toasts when a change is saved or fails.

## Verification

- Run: `npm test` (tests in this directory: `names.test.ts`)
