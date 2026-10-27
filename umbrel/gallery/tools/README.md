# Store screenshot tools

## Overview

Scripts that retake the umbrelOS App Store screenshots from the real app,
built for production, against a throwaway Hermes Agent filled with invented
demo data and driven by a scripted model. `retake.sh` runs the whole pipeline;
the `.mjs` files are its steps and can also be run on their own. The process
is described for maintainers in [../../README.md](../../README.md) under
"Store screenshots".

## Interface

- `retake.sh`: end-to-end driver. Run from anywhere as `sh umbrel/gallery/tools/retake.sh`. Starts `model.mjs`, a Hermes container (`murmur-gallery-hermes`, image read from `dev/docker-compose.yml`) on an empty temp data folder, a production `vite build` served by `node server/index.ts`, then runs `seed.mjs` and passes the group id it prints to `capture.mjs`. Ports: `HERMES_PORT` (default `18889`), `MODEL_PORT` (`18991`), `MURMUR_PORT` (`3217`).
- `model.mjs`: scripted OpenAI-compatible HTTP server (`PORT`, default `18991`). Serves `GET /v1/models` (or `/models`) and `POST /v1/chat/completions`, streaming or not. Picks a reply by a key phrase in the chat's opening user message (`CHATS`), answers `session_title` requests from `TITLES`, and answers group turns by the member's `@handle` (`GROUP`), once per member per message. `DEBUG=1` logs tool-step context.
- `seed.mjs`: demo-data loader. Requires `HERMES_URL`, `CONTAINER` and `DATA` (the container's `/opt/data` on the host); optional `MODEL_URL`. Adds a custom endpoint to the `default` profile, creates six agents (Scout, Wren, Basil, Sunny, Quill, Ada) with one chat each, sets up the "Lisbon weekend" hosted room, backdates the chats, and prints the room id as its last stdout line. Imports `connect`, `rest` and `sleep` from [`docs/hermes/scripts/ar-lib.mjs`](../../../docs/hermes/scripts/ar-lib.mjs).
- `capture.mjs`: Playwright capture. Requires a running Murmur at `MURMUR_URL` (default `http://localhost:3000`) and `GROUP` for shot 3. Optional first argument `1`-`5` takes a single shot. Writes `1.jpg`-`5.jpg`.

## Invariants

- Never point these tools at a real Hermes. `seed.mjs` refuses any `HERMES_URL` on port `18789` (where a real Hermes usually lives) and requires a container name it is allowed to stop.
- Output is deterministic only because `model.mjs` is scripted; prompts in `seed.mjs` and `capture.mjs` must keep containing the key phrases in `model.mjs` (`CHATS[].key`, `TITLES`), and the UI text `capture.mjs` waits for (for example "check with you first", "41 GB free again", the `Allow` button, the `Message Hermes` placeholder) must keep matching the app.
- `seed.mjs` sets approvals to `manual` and seeds the phone-backup files, because shot 2 needs a live approval prompt; capture order is 2 first, then 1, 3, 4, 5.
- `seed.mjs` backdates sessions only while the Hermes container is stopped, so Hermes does not write underneath the SQLite edits.
- `capture.mjs` renders at 1440x900 with device scale factor 2, scales down to 1440x900 and saves JPEG (quality 0.9). The store gallery in `../murmur/` is `1.webp`-`8.webp`, so these captures are raw material, not drop-in replacements for the shipped images.
- Needs Docker, Node 22+ (`node:sqlite`, running `server/index.ts` directly) and Playwright's Chromium (`npx playwright install chromium`).

## Side Effects

- `retake.sh`: creates a temp work dir (`mktemp -d`), runs and then force-removes the `murmur-gallery-hermes` container, binds the three ports, and kills its background processes on exit, interrupt or termination.
- `seed.mjs`: writes through the Hermes REST and WebSocket APIs (custom endpoint, profiles, sessions, model turns, hosted room); appends an `approvals:` block to `$DATA/config.yaml` if absent; creates three sparse ~13-14 GB files under `$DATA/home/Downloads/phone-backups`; runs `docker stop`/`docker start` on `CONTAINER`; edits `$DATA/profiles/<id>/state.db` with `node:sqlite`.
- `capture.mjs`: launches headless Chromium, sends one live chat that ends with the agent deleting the seeded backups after `Allow` is clicked, and overwrites `umbrel/gallery/murmur/<n>.jpg`.
- `model.mjs`: listens on `PORT`; no disk access.

## Verification

- No automated test target. Run `sh umbrel/gallery/tools/retake.sh` (about two minutes) and review the images it writes.
- The repo suite (`npm test`, vitest) does not cover these tools.
