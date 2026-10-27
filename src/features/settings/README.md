# settings

## Overview

The Settings screens and their building blocks: the page layout and two-level navigation stack, theme, Hermes servers, models and services (including models Hermes runs itself), picture generation, the Umbrel MCP connection, and a reusable yes/no prompt. State comes from `src/state/models.ts`, `src/state/connection.ts`, `src/state/local-runtime.ts`, `src/state/pictures.ts` and `src/state/umbrel-mcp.ts`.

## Interface

- `theme.ts`: `useTheme`, `setTheme(pref)`, `THEME_KEY` and `THEME_EVENT` (both `'murmur:theme'`), and the type `ThemePref` (`'light' | 'dark' | 'system'`).
- `ask.tsx`: `ask({...})`, which resolves to a boolean, and `AskHost`. Render `AskHost` once on any screen that calls `ask`.
- `page.tsx`: `Page` and `Tile`. A large title hands off to a small centred title in a glass bar as you scroll.
- `stack.tsx`: `Stack`, an iOS-style two-level navigation stack. On phones you can drag back from the left edge.
- `swap.tsx`: `Swap`, text that changes in place (200 ms). Its `id` prop decides when the text counts as a new line.
- `hermes-section.tsx`: `HermesSection`, Settings → Server.
- `models-section.tsx`: `ModelsSection`, the main agent's model and the connected services.
- `connect-flow.tsx`: `ConnectFlow`, "Connect a model" connected to Hermes. It is used full screen in onboarding and in a sheet in Settings.
- `local-service.tsx`: `LocalService`, the models Hermes runs itself, and the models downloaded for each service.
- `pictures-row.tsx`: `PicturesRow`, "Let agents make pictures". Render it only when ChatGPT is connected.
- `umbrel-section.tsx`: `UmbrelSection`, Settings → Umbrel.

## Invariants

- The theme is a browser choice, not a choice of any one Hermes, so it is stored under one shared key. `index.html` applies it before the first paint and must stay in step with `theme.ts`. `<html data-theme>` forces light or dark. With no attribute, the theme follows the system.
- Removing a local model first moves any agent that uses it onto another model, then deletes it from Hermes's machine.
- The Umbrel MCP key is added to each agent by Murmur (`src/state/umbrel-mcp.ts`), so no chat or model provider ever sees it.

## Side Effects

- `theme.ts` writes `localStorage` `murmur:theme` (removed for `system`). It sets `data-theme` and the `theme-color` and `color-scheme` meta tags, calls `window.murmurDesktop?.setTheme`, and dispatches the `murmur:theme` window event. When imported, it adds a `storage` listener so the theme follows changes made in other tabs.
- Model and service actions (`connectApiKey`, `connectLocal`, `adoptChatGPT`, `disconnect`, `setMainModel`, `removeDownloaded`) and Umbrel actions (`connectUmbrel`, `disconnectUmbrel`) change Hermes configuration.
- `hermes-section.tsx` adds and switches Hermes servers through `src/state/connection.ts`. Switching reloads the app.
- `umbrel-section.tsx` opens umbrelOS settings in a new tab.

## Verification

- Run: `npm test`
