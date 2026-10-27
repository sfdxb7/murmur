# desktop/scripts

## Overview

Node scripts that build, run, package and test the Electron desktop app. They run directly with `node` (TypeScript via Node's type stripping) and are wired to `package.json` scripts. See [docs/DESKTOP.md](../../docs/DESKTOP.md) for the full workflow, signing and CI.

## Interface

- `build.ts`: `npm run desktop:build` (after `npm run build`), or `node desktop/scripts/build.ts [--dev]`. Assembles `desktop/app/`, the folder that electron-builder packages. It contains `main.js` and `preload.js` (esbuild, CommonJS, `node22`, `electron` external), `web/` (a copy of `dist/` without `.gz` files), `package.json`, `icon.png` and the licenses.
  - `appDir`: absolute path of `desktop/app`
  - `bundleOptions(dev: boolean): BuildOptions`: defines `__MURMUR_VERSION__` and `__MURMUR_UPDATES__`
  - `assemble(dev?: boolean): Promise<void>`
- `dev.ts`: `npm run desktop:dev`. Starts Vite and an esbuild watcher, then launches Electron on `desktop/app`. It sets `MURMUR_SERVER`, `MURMUR_DEV_URL` and `MURMUR_DEV_SERVER_PORT`, and restarts Electron whenever `desktop/` or `server/` changes.
- `dist.ts`: `npm run desktop:dist [-- electron-builder args]`. Runs electron-builder and adds `--publish never` unless a publish option is passed. Signing and notarization are skipped when there is no certificate; on macOS it then signs ad hoc.
- `icons.ts`: `npm run desktop:icons`. Renders `design/icon/*.svg` with Playwright Chromium into `desktop/resources/` (`icon.icns`, `icon.ico`, `icon.png`, `icons/NxN.png`).
- `smoke.ts`: `node desktop/scripts/smoke.ts <executable> [screenshot.png]`. Launches a packaged app on throwaway data and attaches over the Chrome DevTools Protocol. It clicks "Get started", waits for "Hermes address" and checks the frozen `window.murmurDesktop` bridge and `data-desktop`. It prints `murmur-smoke-ok` or `murmur-smoke-failed` and exits 0 or 1. A missing executable argument exits 2.
- `before-build.cjs`: electron-builder's `beforeBuild` hook. It returns `false`, so no `node_modules` are installed or packaged.

## Invariants

- `desktop/app/` has no dependencies: everything is bundled into `main.js` and `preload.js`. `before-build.cjs` must keep returning `false`, or electron-builder would package the root `node_modules`.
- A full (non-dev) `assemble` requires `dist/index.html` and throws otherwise. Run `npm run build` first.
- `__MURMUR_UPDATES__` is true only for non-dev builds made with `MURMUR_UPDATES=1`.
- `dist.ts` never publishes unless `-p` or `--publish...` is passed. It treats empty `CSC_*`, `WIN_CSC_*` and `APPLE_*` variables as unset.
- The icon outputs in `desktop/resources/` are committed. Packaging must not need a browser.
- `smoke.ts` uses CDP (`--remote-debugging-port=0`), not Playwright's `_electron`. Release fuses disable the Node inspector.

## Side Effects

- `build.ts` deletes and recreates `desktop/app/`. It copies `dist/`, `LICENSE`, `src/hermes/vendor/LICENSE` and `desktop/resources/icon.png` into it.
- `dev.ts` binds a free loopback port and the Vite dev server, spawns Electron, and writes to the "Murmur Dev" userData directory through the app.
- `dist.ts` spawns electron-builder. Installers go to `desktop/release/`. Signing or notarization runs only when credentials are present.
- `icons.ts` launches headless Chromium and overwrites the files in `desktop/resources/`.
- `smoke.ts` creates and removes a temporary `murmur-smoke-*` userData directory, spawns the app, and optionally writes a screenshot.

## Verification

- Run: `npm run typecheck` (`tsconfig.desktop.json` includes `desktop/`)
- Packaged smoke test: `npm run desktop:dist -- --dir`, then `node desktop/scripts/smoke.ts <path to the unpacked executable> shot.png`
