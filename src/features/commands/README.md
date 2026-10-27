# commands

## Overview

Slash commands typed in the composer, the command palette, and keyboard shortcuts. A short curated set of commands is described in plain words. Anything else typed after a slash is sent to Hermes unchanged.

## Interface

- `commands.ts`:
  - Types: `CommandName` (`new`, `model`, `think`, `retry`, `undo`, `rename`, `stop`, `btw`, `goal`), `Command`, `CommandOption` and `Palette`.
  - `commandList`, `isCurated(name)`, `parseCommand(text)`, `paletteFor(...)` and `filterCommands(...)`.
- `use-catalog.ts`: `useCatalog` and the type `Catalog`. These are the Hermes commands worth offering, fetched with the gateway RPC `commands.catalog`.
- `command-palette.tsx`: `CommandPalette`, `useCommandPalette` and the type `CommandPaletteState`. Murmur's own commands each show their shortcut.
- `shortcuts.tsx`:
  - Shortcut helpers: `isMac`, `caps(combo)`, `hint(combo)`, `useShortcuts(enabled)` and `Keys`.
  - Actions: `openShortcuts`, `registerSearch(focus)`, `focusSearch` and `newChat`.
  - `ShortcutsSheet`, the sheet opened with "?" that lists every shortcut.

## Invariants

- Typed commands that are not in the curated list still go to Hermes as-is (`passthrough`).
- A `Command` with `run` is handled by Murmur and never sent to the chat.
- Shortcuts use `mod`, which is Cmd on a Mac and Ctrl everywhere else. While you are typing, only Cmd/Ctrl combos work, plus Alt+Up and Alt+Down in an empty box.
- Every shortcut is listed in `ShortcutsSheet`.

## Side Effects

- `use-catalog.ts` calls the gateway RPC `commands.catalog` for the current agent.
- `useShortcuts` adds a global window `keydown` listener while it is enabled.

## Verification

- Run: `npm test`
