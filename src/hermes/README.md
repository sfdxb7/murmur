# hermes

## Overview

This is Murmur's client for the Hermes agent gateway. There are two channels, and both go through the Murmur server under `/hermes`:

- One long-lived JSON-RPC WebSocket at `/hermes/api/ws`, using the protocol Hermes Desktop speaks. This module dials it and redials it when it drops.
- Plain `fetch` calls to the Hermes dashboard REST API at `/hermes/api/...`. The Murmur server attaches the session token.

One Murmur can be connected to several Hermes instances. Each browser tab is pinned to a single one, and `instance.ts` tracks which.

## Interface

- `gateway.ts`
  - `gateway`: the single `JsonRpcGatewayClient` instance (request id prefix `m`).
  - `useConnection`: zustand store `{ state: ConnectionState; everOpened: boolean }`.
  - `startGateway()`: idempotent. It subscribes to state changes and wake events, then dials. `stopGateway()` hangs up permanently. `redialNow()` skips the current backoff wait.
  - `whenOpen()`: resolves once the socket is open.
  - `rpc<T>(method, params?, timeoutMs?)`: waits for the socket to open, then calls `gateway.request`.
  - Re-exported types: `GatewayEvent`, `ServerRequest`.
- `rest.ts`
  - `api.get/post/put/patch/delete<T>(path, body?, init?)`: JSON fetch to `/hermes${path}`.
  - `HermesError` (`status`, `detail`), `hermesHeaders(headers?)`, `within(ms)` (an abort-timeout `RequestInit`).
  - `SESSION_CHECK` event name (`'murmur:check-session'`).
- `instance.ts`
  - `HERMES_HEADER` (`'x-murmur-hermes'`), `HERMES_PARAM` (`'hermes'`), `HERMES_GONE` event name (`'murmur:hermes-gone'`).
  - `browserHermes()`: reads the `murmur_hermes` cookie. `tabHermes()`: the Hermes this tab is pinned to.
  - `scoped(key)`: the localStorage key for this Hermes. `adoptHermes(id)` switches to `id` and returns false when a reload is needed. `forgetHermesStorage(id)`.
- `compat.ts`
  - `isMissingMethod(error)`: true for JSON-RPC error -32601. `retryUnlessMissing(failures, error)`: a retry predicate.
  - `listProfiles(params?)`: calls `profiles.list` over RPC and falls back to REST `/api/profiles`. `listProfileNames()`.
- [vendor](./vendor/README.md): the vendored upstream Hermes JSON-RPC client and generated wire contract (`JsonRpcGatewayClient`, `JsonRpcRequestChannel`, `RPC_METHODS`, `GATEWAY_EVENT_TYPES`, wire types).

## Invariants

- Each tab has exactly one gateway socket. Create clients only through `gateway.ts`, never with `new JsonRpcGatewayClient` elsewhere.
- Every REST request and the socket URL carry the tab's Hermes id: the `x-murmur-hermes` header, or `?hermes=` on the socket. This keeps two Hermes instances from mixing. Switching Hermes reloads the app.
- `scoped()` leaves keys unchanged for the first Hermes (ids `env`, `main`, `default`, or none), so existing storage is kept. Any other id rewrites `murmur:` keys to `murmur@<id>:`.
- Redial backoff is 0.5 s doubling, with ±15% jitter. It is capped at 4 s while the page is visible and 15 s while hidden. Only the first failure report schedules a retry.
- `compat.ts` supports older Hermes releases (0.19 has no `profiles.*` or `groups.*`). After `profiles.list` returns "method not found" once, later calls go straight to REST. Callers should hide features that hit -32601 instead of retrying them.
- Do not edit `vendor/` by hand. See its README.

## Side Effects

- Opens a WebSocket to `ws(s)://<host>/hermes/api/ws` and redials with timers.
- Adds listeners for `visibilitychange` on `document` and `focus` and `online` on `window`. They are never removed.
- Fires `murmur:check-session` on `window` when a REST call returns 401 `signed_out`, or after 3 or more failed dials in a row. Fires `murmur:hermes-gone` on a 409 `hermes_gone`, or when the cookie names a different Hermes than this tab is pinned to.
- `fetch` to `/hermes/*`. A successful REST response triggers `redialNow()`.
- Reads `document.cookie`. `forgetHermesStorage` deletes `murmur@<id>:*` keys from `localStorage` and `sessionStorage`.
- `compat.ts` keeps module-level state (`restOnly`).

## Verification

- Run: `npm test`
- Run: `npm run typecheck`
