# ui

## Overview

Murmur's design-system primitives: buttons, fields, lists, sheets, toggles, segmented controls, skeletons, spinners, the brand marks, the hand-drawn icon set, and the Buddy (every agent's animated face). Components are presentational. They take props and render, styled with Tailwind classes and a few colocated CSS files. They do not read app state or call Hermes. `lab.tsx` is a dev-only gallery served at `/ui.html`.

## Interface

- `button.tsx`: `Button` and `IconButton` (forwardRef). Variants: `primary`, `secondary`, `ghost`, `danger`, `accent`. Sizes: `sm`, `md`, `lg`. Also takes `loading`.
- `field.tsx`: `TextField`, `TextArea` (forwardRef), `SecretField` (show/hide input), `Label({ children, hint?, htmlFor? })`.
- `sheet.tsx`: `Sheet({ open, onOpenChange, title, hideTitle?, back?, description?, children, footer?, className?, style?, width? })`. On phones it is a bottom sheet you can swipe away; on wide screens it is a centred dialog. Built on Radix Dialog. `SheetPin({ query, ... })` is a sticky header inside a sheet body.
- `list.tsx`: `ListGroup` and `ListRow({ icon, title, subtitle, detail, onClick, chevron, destructive, trailing })`, grouped inset lists in the iOS Settings style.
- `segmented.tsx`: `Segmented<T extends string>`, a segmented control with keyboard arrow support.
- `toggle.tsx`: `Toggle`, an iOS-style switch.
- `confirm-card.tsx`: `ConfirmCard({ label, title, body, confirm, onConfirm, className? })`, an inline two-step confirm for destructive actions.
- `grow.tsx`: `Grow`, a block whose height springs to fit its content.
- `skeleton.tsx`: `Skeleton` and `SkeletonText({ lines? })`. `spinner.tsx`: `Spinner({ size? })`.
- `buddy.tsx` (+ `buddy.css`)
  - `Buddy({ hue, size?, state?, seed?, className?, label? })`, `BuddyStack`, `BuddyRow`.
  - `BuddyState` is one of `idle`, `listening`, `speaking`, `thinking`, `working`, `waiting`, `done`, `error` or `offline`. Type `BuddyMember`.
- `orb.tsx`: legacy aliases `Orb` (= `Buddy`), `OrbStack` (= `BuddyStack`), `OrbState`. New code should import from `./buddy`.
- `brand.tsx` (+ `brand.css`): `BRAND` colour constants, `MurmurMark`, `MurmurWordmark`, `ByUmbrel`, `UmbrelIcon`.
- `icons.tsx` (+ `icons.css`): type `IconProps`, `IconChip`, and about 40 two-layer feature icons (`AgentsIcon`, `ModelsIcon`, `ServerIcon`, `RoutinesIcon`, `MemoryIcon`, `AppsIcon`, `PasswordsIcon` and others).
- `titlebar.tsx`: `TitlebarStrip()` and `WindowControlsGap({ side, column?, flexGap? })`, spacing for the Electron window chrome. In a browser they render nothing.
- `lab.tsx`: dev-only entry for `ui.html`. It mounts its own React root and has no exports.

## Invariants

- Primitives stay presentational. The only internal imports are `@/lib/cn` and `@/lib/use-media` (`Sheet` uses `useIsWide`). Never import from `@/state` or `@/hermes`. The one exception is `lab.tsx`, a dev-only page, which imports `Island` from `@/screens/connection-banner`.
- Agent colour is passed as an OKLCH hue number (see `@/lib/hues`). The Buddy derives proportions and rhythm from `seed` deterministically, so the same agent always looks the same.
- Animations use transform and opacity only, and respect `prefers-reduced-motion`.
- Utility chrome (chevrons, close, send, copy) uses `lucide-react`. Murmur's own icons are for feature identity only.
- `Sheet` must stay accessible. It uses Radix Dialog semantics, a title that is always announced even when `hideTitle` is set, closing on Escape and scrim tap, and returning focus to whatever opened it.
- Brand SVG colours are literal values (not CSS variables), so the mark stays portable when exported (see `docs/BRAND.md`).

## Side Effects

- `sheet.tsx` adds a capture-phase `pointerdown` listener on `window` at import time to remember where the last press happened, so a dialog can grow from it. It also adds a scroll listener on the sheet body for `SheetPin`, removed on unmount.
- Radix portals render sheets into `document.body`.
- `lab.tsx` calls `createRoot` on the `ui.html` page and imports `src/styles.css`.
- Otherwise none: no network, storage or global state.

## Verification

- Run: `npm test`
- Run: `npm run typecheck`
- Visual check: open `/ui.html` in the Vite dev server (`lab.tsx`).
