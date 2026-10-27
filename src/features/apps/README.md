# apps

## Overview

The Apps feature: connecting an agent to apps from Hermes's MCP catalog, including apps on this Umbrel. It also draws app icons, because the catalog has none.

## Interface

- `index.ts` re-exports `AppsSheet`, `AppIcon`, `appName` and `AppsGlyph`.
- `apps-sheet.tsx`: `AppsSheet`, which lists, connects, enables, disables and removes an agent's apps.
- `app-icon.tsx`: `AppIcon`, plus `appName(id)` (the name as the maker writes it) and `isLight`.
- `apps-glyph.tsx`: `AppsGlyph`, the Apps tile icon on an agent's page. It shows a small folder of the agent's apps, or a lit chip when there are none.
- `marks.ts`: `MARKS` and the type `Mark`. These are brand names, colours and 24x24 glyphs generated once from simple-icons 16.35.0 and edited by hand since.

## Invariants

- An app without a mark gets a monogram in its colour. A broken image is never shown.
- `marks.ts` is static data. Add entries by hand; it is not regenerated.
- All connection state and actions come from `src/state/apps.ts` and `src/state/umbrel-mcp.ts`.

## Side Effects

- Calls `connectApp`, `connectOnUmbrel`, `setAppEnabled`, `removeApp`, `cancelConnect`, `clearConnection` and `openSignInTab` from `src/state/apps.ts`. These change the agent's MCP configuration on Hermes. In the browser (not the desktop app), `openSignInTab` opens a new tab for the app's sign-in.

## Verification

- Run: `npm test`
