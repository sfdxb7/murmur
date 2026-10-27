# scripts

## Overview

A one-off developer utility for taking screenshots of the web app with Playwright Chromium. It is not wired to any `package.json` script.

## Interface

- `shot.mjs`: `node scripts/shot.mjs <url> <out.png> [width=390] [height=844] [scheme=dark] [scale=2]`
  - Opens `url` in headless Chromium with the given viewport, color scheme and device scale factor.
  - Waits for `networkidle`, then `WAIT` ms (env, default 600), and saves a screenshot to `out.png`.

## Invariants

- Requires `@playwright/test` and its Chromium browser to be installed.
- Navigation errors are swallowed (`goto(...).catch`). A screenshot is taken even if the page failed to load.

## Side Effects

- Launches a headless Chromium process.
- Makes network requests to `url`.
- Writes the PNG to `out.png`.

## Verification

- Run manually: `node scripts/shot.mjs http://localhost:5173/ /tmp/shot.png`
