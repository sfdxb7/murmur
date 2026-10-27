# onboarding

## Overview

Murmur's first run. The steps are: Welcome (a murmuration animation that lands as the Murmur mark), "Where should your agents live?", "Connect to Hermes" when no Hermes was found, Getting ready while the built-in Hermes first starts, "Connect a model", shaping the first agent, and the closing screens (Done, or "Your agents are here" when the chosen Hermes already has agents). Setup state is in `src/state/setup.ts`, `src/state/readiness.ts`, `src/state/connection.ts` and `src/state/local-jobs.ts`.

## Interface

- `setup-flow.tsx`: `SetupFlow`, the routed first-run flow shown inside `HermesGate`, and `useBuiltinConnection`.
- `welcome.tsx`: `Welcome`. `murmuration.ts`: `startMurmuration` and the type `MurmurStage`, the 2D canvas animation.
- `where.tsx`: `WhereStep` and the types `WhereProps` and `Chosen`. The step is driven entirely by props.
- `getting-ready.tsx`: `GettingReady` and `GettingReadyProps`.
- `connect.tsx`: `ConnectModel`, `API_KEY_SERVICES` and the types `ConnectOption`, `DeviceCode`, `ChatGPTFlow`, `LocalModel`, `LocalServer`, `ApiKeyService`, `ConnectState` and `FindState`.
- `first-agent.tsx`: `FirstAgent`.
- `done.tsx`: `Done`.
- `arrived.tsx`: `Arrived`, `markArrived`, `readArrived`, `clearArrived` and the types `ArrivedAgent` and `Arrival`.
- `bloom.tsx`: `Bloom`, a one-time ripple around an orb.
- `step.tsx`: `StepHeader`, `BackPill` and `STEP_COLUMN`, the layout shared by every step.
- `setup-copy.ts`: `whereBody`, `problemLine`, `arrivedCopy`, `placeOf`, `useLabel`, `agentHue` and `hasAgentsOrChats`. `connect-copy.ts`: `emptyLine`.
- Dev pages: `playground.tsx` (`Playground`, `/onboarding.html?screen=…`) and `setup-playground.tsx` (`SetupPlayground`). Both use fake data only.
- `welcome.css`.

## Invariants

- `ConnectModel` only renders the `state` it is given. The parent component runs every async step.
- Getting ready marks its steps done only when they really happen (Hermes answers, then Murmur signs in to it), never on a timer. It is a state of the gate, not a route, so reloading during the start returns to it.
- When a Hermes is found, it is offered first. Starting fresh with the built-in Hermes is offered below it. When nothing is found, starting fresh is offered first.
- The animation in `murmuration.ts` takes its shapes from the real mark, so the two always match. `Bloom` renders nothing under reduced motion.
- Text that needs testing is kept in `setup-copy.ts` and `connect-copy.ts`.

## Side Effects

- `setup-flow.tsx` calls `fetch('/murmur/connection')` with the built-in Hermes header. It chooses or adds a Hermes through `src/state/setup.ts` and `src/state/connection.ts`, and records Welcome as seen with `markWelcomed`.
- `arrived.tsx` stores the arrival in `sessionStorage` under `murmur:arrived`.
- `connect.tsx` opens sign-in and verification pages in new tabs (`window.open`) and copies device codes to the clipboard.

## Verification

- Run: `npm test` (tests in this directory: `connect-copy.test.ts`, `setup-copy.test.ts`)
