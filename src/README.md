# src

## Overview

The Murmur web app (React 19, Vite, TypeScript, Tailwind 4). `main.tsx` mounts `App` from `app.tsx` behind the password `AccessGate`. `App` wires the query client, view-transition router, Hermes gate, onboarding gate and app shell, and routes to the screens in `./screens`. The other `*-main.tsx` files are dev-only review pages, each with its own HTML entry at the repo root. Imports use the `@/` alias for this folder (`vite.config.ts`).

## Interface

- `main.tsx`: production entry for `index.html`. Renders `TitlebarStrip`, then `AccessGate` wrapping `App`, under `StrictMode`, and imports `styles.css`.
- `app.tsx`:
  - `App`: providers (`QueryClientProvider`, `MotionConfig reducedMotion="user"`, wouter `Router` with `useTransitionLocation`), `HermesGate`, `Gate`, `Shell`, `Overlays` and the routes:
    - `/chat/:agent/:chat?`
    - `/agent/:agent`
    - `/chats/:agent`
    - `/agents`
    - `/group/:group`
    - `/settings/:section?`
    - `/welcome/:step?`
    - `/` (home)
  - `queryClient`: the shared React Query client (retry `retryUnlessMissing`, refetch on window focus).
- Dev-only entries:
  - `buddy-main.tsx` → `buddy.html`
  - `connection-main.tsx` → `connection.html`
  - `onboarding-main.tsx` → `onboarding.html`
  - `playground-main.tsx` → `playground.html`
  - `routines-main.tsx` → `routines.html?agent=…`
- `env.d.ts`: declares `__MURMUR_VERSION__` (set at build time).
- `styles.css`: global styles and design tokens.
- Child packages:
  - [./screens/README.md](./screens/README.md): top-level routed pages.
  - [./features/README.md](./features/README.md): 23 feature packages (chat, agents, groups, routines, settings, onboarding and more).
  - [./state/README.md](./state/README.md): client domain layer (React Query hooks, zustand stores, actions over Hermes and `/murmur/*`).
  - [./hermes/README.md](./hermes/README.md): the gateway WebSocket, REST wrapper, per-tab Hermes pinning and compatibility fallbacks, plus the vendored typed client.
  - [./lib/README.md](./lib/README.md): router transitions, swipe-back, media queries, lazy loading, upkeep queue, hues, haptics, desktop bridge.
  - [./ui/README.md](./ui/README.md): presentational design-system primitives, icons, brand marks and the Buddy avatar.

## Invariants

- `AccessGate` sits outside `QueryClientProvider` and `App`, so nothing connects before sign-in. On standalone installs `HermesGate` must pick a Hermes before the gateway dials (`Dial` mounts inside it).
- `Gate` sends first-run or no-model Hermes to `/welcome` (`/settings/hermes` stays reachable). It marks a Hermes that is already in use as welcomed. It holds the splash until agents (and, briefly, groups) load.
- `wireChats`, `wireNotices` and `wireSessionLists` run once per tab from `App`'s mount effect.
- Rarely opened screens (`Group`, `Settings`, `Onboarding`, `Agent`, `Chats`, `Agents`) and Markdown are lazy chunks, preloaded when idle. Markdown loads at once only when the app opens straight into `/chat/` or `/group/`.
- Phone pages are wrapped in `Pushed` or `SwipeBack`. Wide layouts show the sidebar (`SIDEBAR_WIDTH`) instead.
- Layering: `screens` compose `features`, `features` render `state`, and `state` talks to `hermes`. It is not strictly one-way: `state` imports types and pure helpers back from `features` (for example `chat/types`, `chat/live`, `chat/tool-labels`, `media/parse`, `routines/runs`, `group/mentions`). `ui` (except the dev-only `lab.tsx`) never imports `state` or `hermes`.

## Side Effects

- Starts the Hermes gateway WebSocket (`startGateway`) once a Hermes is chosen.
- Sets `document.title` with the unread count while the tab is hidden, and marks chats seen on `visibilitychange`.
- Sets the desktop app's dock or taskbar badge (`setDesktopBadge`).
- Offers and shows system notifications (`useSystemNotifications`).
- Runs background sync hooks (pictures, Umbrel context, Umbrel MCP, desktop toolsets, timezone) that write config on the Hermes host.

## Verification

- Run: `npm test`
- Run: `npm run typecheck`
