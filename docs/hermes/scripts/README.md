# Hermes probe scripts

## Overview

Standalone Node 22+ ES-module scripts that exercise a live Hermes Agent gateway
(`/api/ws` JSON-RPC 2.0 and the dashboard REST API). They produced the
`[LIVE]` evidence in the protocol notes one level up
([chat-protocol.md](../chat-protocol.md),
[agents-and-rooms.md](../agents-and-rooms.md),
[models-and-onboarding.md](../models-and-onboarding.md)). Each script prints
the frames or responses it sees to stdout; they are evidence-gathering tools,
not assertions, and are not part of Murmur's build or test suite.

Three families, each with its own self-contained helper library:

| Family | Helper | Covers |
|---|---|---|
| `01-*.mjs` to `15-*.mjs` | `lib.mjs` | Chat protocol: connect, auth/origin gate, turns, approvals, reconnect, busy/queue, model and effort, parallel sessions, attachments, clarify, error shapes, multi-socket fan-out |
| `ar-*.mjs` | `ar-lib.mjs` | Agents (profiles) and hosted rooms (`groups.*`): profile CRUD over RPC and REST, canonical chats, room routing/stop/live stream/offline catch-up, approval roster status, Desktop interop, cleanup |
| `models-*.mjs` | `models-lib.mjs` | Models, providers and onboarding: options, readiness, API-key and custom-endpoint flows, OAuth error shapes, reasoning effort, per-session model switch, plus a fake OpenAI-compatible server |

## Interface

- `lib.mjs`
  - `BASE`: gateway base URL from `HERMES_URL` (default `http://localhost:18789`).
  - `getToken()`: `HERMES_TOKEN`, else scrapes `__HERMES_SESSION_TOKEN__` from the dashboard HTML (not cached).
  - `rest(path, { method, body })` -> `{ status, json }` or `{ status, text }`.
  - `connect({ label, onRequest, log, maxLog })` -> client with `rpc(method, params, timeoutMs)`, `respond(id, result)`, `fail(id, code, message)`, `on(fn)`, `waitEvent(pred, timeoutMs)`, `close()`, `frames`, `ready` (the `gateway.ready` event). Collapses runs of `*.delta` events in logs unless `LOG_DELTAS=1`; `QUIET=1` silences logging.
  - `ts()`, `sleep(ms)`.
- `ar-lib.mjs`
  - `BASE`, `token()` (scraped once and cached), `rest(method, path, body)` -> `{ status, body }`.
  - `connect({ log, label, onServerRequest })` -> `{ ws, call, tryCall, events, waitFor, close }`. `tryCall` returns `{ ok, result }` or `{ ok: false, error }`; `waitFor` also matches already-buffered events. `LOG=1` prints non-delta events.
  - `sleep(ms)`, `show(label, value)`.
  - Also imported by [`umbrel/gallery/tools/seed.mjs`](../../../umbrel/gallery/tools/seed.mjs).
- `models-lib.mjs`
  - `BASE`, `token()`, `rest(method, path, body, { auth })` (`auth: false` omits the session header).
  - `gw()` -> `{ ws, call, events, close }`; `call` resolves with the raw frame (`{result}` or `{error}`) so error shapes can be recorded. Parses newline-delimited frames.
  - `show(label, value)`, `sleep(ms)`.
- Probe entry points (run directly; usage and env vars are in each file's header comment):
  - Chat protocol: `01-connect`, `02-auth-origin`, `03-turn`, `04-approval`, `05-profiles-setup`, `06-reconnect`, `07-busy`, `08-queue`, `09-model-effort`, `10-parallel`, `11-attachments`, `12-clarify`, `13-errors`, `14-two-sockets`, `15-approval-reconnect`.
  - Agents and rooms: `ar-01-profile-create` through `ar-10-room-offline`, and `ar-99-cleanup`.
  - Models: `models-profile-setup`, `models-options`, `models-readiness`, `models-apikey-flow`, `models-custom-endpoint-flow`, `models-oauth-shapes`, `models-reasoning-flow`, `models-session-model-switch`.
  - `models-fake-openai-server.mjs`: tiny OpenAI/Ollama-compatible HTTP server (`PORT`, default `18990`; optional `REQUIRE_KEY`) that logs each request as one JSON line.

## Invariants

- No dependencies: global `fetch` and `WebSocket` (Node 22+). Exception: `02-auth-origin.mjs` needs the `ws` package, located via `WS_DIR`.
- The three helper libraries are deliberately independent copies; a probe imports only its own family's helper. Changing one does not change the others.
- Every socket waits for the `gateway.ready` event before use. Probes that expect server-to-client requests (approval, clarify) first call `client.capabilities { server_requests: true }`; without a handler, the helpers answer such requests with JSON-RPC error `-32601`.
- Probes must only touch disposable `murmur-test-*` profiles and rooms. The `models-apikey-flow`, `models-custom-endpoint-flow` and `models-session-model-switch` scripts throw unless `PROFILE` starts with `murmur-test-`. Default profiles are `murmur-test-a`/`-b` (numbered), `murmur-test-alpha`/`-beta` (`ar-*`) and `murmur-test-models` (`models-*`).
- Ordering dependencies: `05-profiles-setup` before probes that use `murmur-test-a`/`-b`; `models-reasoning-flow` needs `models-custom-endpoint-flow --keep` and a running `models-fake-openai-server` whose stdout is in `FAKE_LOG`.
- `models-oauth-shapes` never starts, polls or cancels a real device flow; `models-options` and `models-readiness` are read-only.

## Side Effects

- Network: HTTP and WebSocket traffic to `HERMES_URL`; the session token is read from the dashboard page, like Murmur's same-origin proxy.
- Mutates the target Hermes: creates, configures, renames and deletes profiles; creates, closes and deletes sessions; runs model turns (may spend provider credits); creates, stops and disbands hosted rooms; writes and deletes `/api/env` keys and custom endpoints; changes profile and session model settings. `ar-99-cleanup` deletes every `murmur-test-*` profile and disbands their rooms; `05-profiles-setup` with `DELETE=1` removes `murmur-test-a`/`-b`.
- Some probes deliberately ask the agent to run approval-gated commands such as `rm -rf /tmp/murmur-approval-test` (`04-approval`, `15-approval-reconnect`, `ar-08-approval-status`). `04-approval` answers `deny` unless `CHOICE` says otherwise; an `once`/`session`/`always` answer lets the command run inside the Hermes container.
- Local disk: `03-turn` writes all frames to `FRAMES_OUT` when set. No other probe writes local files.
- `models-fake-openai-server` listens on `PORT` and logs request bodies, including the auth header.

## Verification

- No automated test target. Run probes by hand against a live, disposable Hermes, for example `HERMES_URL=http://localhost:18789 node docs/hermes/scripts/01-connect.mjs`, and compare the output with the protocol notes.
- The repo suite (`npm test`, vitest) does not cover these scripts.
