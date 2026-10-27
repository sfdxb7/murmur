# Murmur umbrelOS app package

## Overview

The app folder submitted to [getumbrel/umbrel-apps](https://github.com/getumbrel/umbrel-apps)
as `murmur/`. It declares the store listing and the containers umbrelOS runs:
Murmur's `web` server behind Umbrel's `app_proxy`, and a private, built-in
Hermes Agent that only Murmur can sign in to. The release, submission and
networking details are in [../README.md](../README.md).

## Interface

- `umbrel-app.yml`: store manifest (`manifestVersion: 1.1`, `id: murmur`, `port: 18793`, `storage.dataRoot: data`, no app `dependencies`, `GPU` permission). Lists `gallery:` images `1.webp`-`8.webp` served from umbrel-apps-gallery, plus `version`, `description` and `releaseNotes`.
- `docker-compose.yml`: three services.
  - `app_proxy`: forwards to `murmur_web_1:3000`; `PROXY_AUTH_WHITELIST` lets the PWA manifest and icon files through without the Umbrel login.
  - `web`: `ghcr.io/getumbrel/murmur` pinned by tag and digest, user `1000:1000`, mounts `${APP_DATA_DIR}/data/murmur` at `/data`. Env: `MURMUR_BUILTIN_HERMES_URL` (`http://murmur_hermes_1:9119`), `MURMUR_BUILTIN_HERMES_USERNAME`, `MURMUR_BUILTIN_HERMES_PASSWORD`, `MURMUR_FIND_HERMES` (offers the Hermes Agent app at `hermes-agent_web_1:18789`), `MURMUR_ALLOWED_HOSTS: "*"`.
  - `hermes`: `ghcr.io/getumbrel/hermes-agent-umbrel` pinned by tag and digest, runs `gateway run`, mounts `${APP_DATA_DIR}/data/hermes` at `/opt/data`, with dashboard basic-auth username, password and session secret, `HERMES_GATEWAY_BOOTSTRAP_STATE: running` and `UMBREL_APP_NAME: Murmur`.
- `exports.sh`: exports `APP_MURMUR_HERMES_PASSWORD` and `APP_MURMUR_HERMES_SECRET`, derived per install with umbrelOS's `derive_entropy` from `app_entropy_identifier`.
- `data/murmur/.gitkeep`, `data/hermes/.gitkeep`: ship the data folders so umbrelOS creates them owned by the app user, not root.

## Invariants

- `version` in `umbrel-app.yml` must equal `version` in the root `package.json`; the `release` and `desktop` GitHub workflows read it from this file and refuse a mismatched tag.
- The `web` image must be pinned to the multi-arch digest the `release` workflow publishes for that version.
- The `hermes` image here is the Hermes version Murmur bundles. `dev/docker-compose.yml` must use the same image (`umbrel/gallery/tools/retake.sh` takes its image from there).
- `test/contract/harness.ts` reads the `hermes` image from this file for the contract suite (unless `HERMES_IMAGE` is set) with a regex that expects a two-space `hermes:` key followed by a four-space `image:` line. Keep that layout.
- The built-in Hermes stays private: no `app_proxy`, no published port, and gated by the derived username/password. The password is shared between `web` and `hermes` through `APP_MURMUR_HERMES_PASSWORD` only.
- Murmur's container never mounts `data/hermes`, so Hermes's agents, chats and API keys (its `.env`) are not visible to the `web` container. Both data folders sit under `data/` (`storage.dataRoot`) so umbrelOS moves them together.
- `gallery:` filenames must match the files in [`../gallery/murmur/`](../gallery/README.md) and in umbrel-apps-gallery.

## Side Effects

- On install, umbrelOS runs `exports.sh` to derive secrets, creates `data/murmur` and `data/hermes`, and starts the three containers on `umbrel_main_network`.
- `web` writes `murmur.json` (chosen Hermes, extra servers and their sign-ins) under `${APP_DATA_DIR}/data/murmur`.
- `hermes` writes its config, profiles, chats and API keys under `${APP_DATA_DIR}/data/hermes` and runs the messaging gateway (routines, Telegram).
- `web` reaches the Hermes Agent app over the shared network when that app is installed.

## Verification

- `npm test` (vitest) at the repo root does not exercise this package directly. `npm run test:contract` runs the Hermes contract suite against the `hermes` image pinned here.
- Before submitting, run the store linter in a `getumbrel/umbrel-apps` checkout: `node .tools/lint-apps.mjs murmur --check-images`, then test on a real Umbrel (see [../README.md](../README.md)).
