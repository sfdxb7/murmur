# lib

## Overview

Small client-side helpers shared by screens, UI components and state. This covers the app's navigation and View Transitions router, media-query hooks, lazy-loaded components, background upkeep scheduling, agent colour hues, haptics, and the Electron desktop bridge. Nothing here talks to Hermes.

## Interface

- `transitions.ts`: the history router that wouter reads, with iOS-style View Transitions. It imports `transitions.css`.
  - `useTransitionLocation()`: a `[path, navigate]` hook for wouter's `hook` prop.
  - `navigate(to, { replace?, state? })`, `backInstantly()`, `upFrom(path)`, `useUpFrom(path)`, `previous()`, `previousScroll()`, `arrivedBy()`.
  - `replaceGone(path, to)`: redirects history entries for a deleted page.
  - `handoff(update)`: the dissolve from splash or onboarding into the app.
  - `setMainAgent(id)`, `mainAgentId()`.
- `transitions.css`: `::view-transition-*` animations keyed by `<html data-nav="push|pop|fade|pane|handoff">`. Also the `--vt-ease` and `--vt-dim` custom properties.
- `swipe-back.tsx`: `SwipeBack({ children, under, off? })`, an edge-swipe back gesture for touch devices.
- `use-media.ts`: `useMedia(query)`, `useIsWide()` (min-width 900px), `usePrefersReducedMotion()`, `useFinePointer()`, `SIDEBAR_WIDTH` (308).
- `lazy.tsx`: `lazyComponent(load, fallback?)` returns a component with `.preload()`. `preloadWhenIdle(...components)`.
- `upkeep.ts`: `upkeep(job)` is a serial, idle-time job queue. `rememberedSet(key, ttl?)` is a localStorage-backed id set with `has`, `add`, `delete` and `clear`.
- `hues.ts`: `HUES` (12 OKLCH hue angles), `hueFor(seed)`, `phaseFor(seed)`, `hexHue(hex)`.
- `desktop.ts`: `desktop` (`window.murmurDesktop` or undefined), `isDesktop`, `isMacDesktop`, `desktopChrome()`, `setDesktopBadge(count)`, `focusWindow()`. Types `MurmurDesktop`, `DesktopPlatform`, `DesktopChrome`.
- `haptics.ts`: `haptic(kind?)`, where kind is `'tick' | 'success' | 'warning'`.
- `cn.ts`: `cn(...classValues)`, a `clsx` wrapper.

## Invariants

- All app navigation goes through `transitions.ts`, which stores `{ murmur: pos }` in `history.state` to tell back from forward. Use `navigate()` instead of `history.pushState` or wouter's default location. The only other history writes are in-place `replaceState` calls: `src/state/umbrel-mcp.ts` uses one to scrub the URL fragment, and the dev playground uses another.
- Navigating to the page you came from calls `history.back()`, so history stays a stack.
- No animation runs for moves within the same screen (`/chat/<id>`, `/group/<id>`, `/agent/<id>`, `/settings*`, `/welcome*`). Wide layouts (900px and up) always use `pane`. Reduced motion uses `fade`. Browsers without View Transitions change instantly.
- `useMedia` keeps one subscribe function per query string. Do not create the subscribe function inside render.
- `upkeep()` jobs run one at a time, and only after an 800 ms delay plus idle time. A failed job does not block the queue.
- `hueFor` and `phaseFor` are deterministic for a given seed. `hexHue` returns undefined for invalid or grey colours and snaps the result to `HUES`.
- `haptic()` only vibrates on Android during a user gesture.
- `desktop` and the other `desktop.ts` exports are undefined or no-ops in a browser. `setTheme` may be missing in older desktop builds.
- `SwipeBack` is active only on coarse pointers. On iOS it is active only when the app is installed (standalone).

## Side Effects

- `transitions.ts` runs at import time: it sets `history.scrollRestoration = 'manual'`, may call `history.replaceState`, and adds a global `popstate` listener. During navigation it changes `document.documentElement.dataset.nav`, calls `document.startViewTransition`, and scrolls the window.
- `swipe-back.tsx` adds touch listeners while it is enabled.
- `upkeep.ts` and `lazy.tsx` schedule `setTimeout` and `requestIdleCallback`. `rememberedSet` reads and writes `localStorage`.
- `use-media.ts` subscribes to `matchMedia` change events.
- `haptics.ts` calls `navigator.vibrate`. `desktop.ts` calls the Electron preload bridge (`setBadge`, `focus`) or `window.focus()`.

## Verification

- Run: `npm test`
- Run: `npm run typecheck`
