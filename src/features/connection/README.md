# connection

## Overview

How Murmur reaches a Hermes. This covers Murmur's own sign-in, the gates in front of the app, the "Connect to Hermes" form, finding Hermes instances nearby, switching between several Hermes instances, and the screen shown when a Hermes is too old. The state and API live in `src/state/connection.ts`, `src/state/setup.ts`, `src/state/readiness.ts` and `src/hermes/instance.ts`.

## Interface

- `gate.tsx`:
  - `AccessGate`, Murmur's password sign-in gate.
  - `HermesGate`, which decides whether to show setup, a starting built-in Hermes, an outdated Hermes, or the app.
- `login.tsx`: `LoginScreen`, shown only when the server sets `MURMUR_PASSWORD`.
- `hermes-connection-form.tsx`:
  - Form: `HermesConnectionForm`, `HermesConnectionFormView` and `HermesConnectionFormProps`.
  - Status: `CurrentStatus` and `ManagedHermes`.
  - Helpers: `isUmbrelHermes`, `isBuiltinHermes` and `useOnUmbrel`.
- `nearby.tsx`: `useNearbyHermes`, `NearbyList`, `placeOf`, `fromFound` and the type `NearbyHermes`.
- `switcher.tsx`: `HermesSwitcher` (a pill), `HermesPicker`, `useCurrentHermes`, `toneOf`, `hermesDetail` and `hostOf`.
- `curtain.tsx`: `SwitchCurtain` and `CurtainLift`, the transition shown while switching Hermes.
- `update-hermes.tsx`: `UpdateHermes`. `no-hermes.tsx`: `NoHermesSheet`.
- `brand-header.tsx`: `BrandHeader`. `fields.tsx`: `Field`, `PasswordField`, `Note` and `StatusDot`.
- `playground.tsx`: `ConnectionPlayground`, a dev page at `/connection.html?view=…` that uses fake answers.

## Invariants

- `AccessGate` wraps the app outside its `QueryClientProvider` (in `main.tsx`), so nothing starts before sign-in, including the Hermes socket. It renders its children at once when the server has no `MURMUR_PASSWORD`.
- A Hermes set by the environment, or built into Murmur, is shown as a read-only card instead of the address form.
- Nearby candidates are checked once, in parallel, through `POST /murmur/connection/test`, which saves nothing. Candidates that do not answer are not listed.
- `HermesSwitcher` renders nothing until there are at least two Hermes instances. In the UI, a Hermes is called a "server".
- The built-in Hermes is shown as starting, not down, during its first start.

## Side Effects

- Calls Murmur server routes (`/murmur/connection*`, `/murmur/setup`) through `connectionApi` and `fetchSetup`. Connect and switch save the chosen Hermes on the server.
- `gate.tsx` can call `location.reload()` when it adopts a named Hermes. While the built-in Hermes starts, it polls setup every 1.5 s.
- Switching Hermes (`switchHermes`) reloads the app behind `SwitchCurtain`.
- `NoHermesSheet` links to external install guides. When the sheet closes, Murmur checks for a Hermes again.

## Verification

- Run: `npm test`
