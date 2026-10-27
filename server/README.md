# server

## Overview

Murmur's own Node HTTP server, with no runtime dependencies (`node:http`, plus raw sockets for WebSocket upgrades). It serves the built web app and gives the browser a same-origin path to the Hermes dashboard API. It holds Hermes credentials server-side, manages the list of known Hermes instances, and runs first-run setup, Telegram pairing and local model discovery.

It runs in two ways:

- Standalone: `npm start` (`node server/index.ts`) or `npm run dev:server`. `index.ts` reads settings from `process.env` and calls `startServer()`.
- Embedded: the Electron desktop app (`desktop/main.ts`) imports `startServer` from `app.ts` and passes its own options.

Routes (see the header comment in `index.ts`):

| Path | Handler | Purpose |
| --- | --- | --- |
| `/healthz` | `app.ts` | Liveness, always `200 ok`, no checks |
| `/hermes/api/*` (REST and WebSocket) | `proxy.ts`, `hermes.ts` | Proxied to the selected Hermes with credentials attached server-side |
| `/murmur/session`, `/murmur/login`, `/murmur/logout` | `access.ts` | Optional `MURMUR_PASSWORD` sign-in |
| `/murmur/setup` | `setup.ts`, `discovery.ts` | First-run choice of where agents live |
| `/murmur/connections`, `/murmur/connection` | `connection.ts` | Manage Hermes instances and the one each browser uses |
| `/murmur/telegram/*` | `telegram.ts` | Server-driven Telegram bot pairing |
| `/murmur/local` | `app.ts` | Finds OpenAI-compatible model servers (Ollama, LocalAI) |
| `/hermes/api/mcp/oauth/callback/<name>` | `oauth-return.ts` | MCP OAuth return relay |
| everything else | `app.ts` | Static web app with SPA fallback |

## Interface

- `index.ts`: CLI entry point. Starts the server, waits for `setupSettled()`, and logs the target Hermes and data directory.
- `app.ts`
  - `startServer(options?: ServerOptions): Promise<RunningServer>`
  - `type ServerOptions = { port?, host?, dataDir?, staticDir?, env?, requireHeader?: { name, value } }`
  - `type RunningServer = { url, port, server: http.Server, close(): Promise<void> }`
- `config.ts`: settings and persisted state in `DATA_DIR/murmur.json`.
  - Settings: `useEnv`, `setting`, `memo`, `dataDir`
  - Targets: `listTargets`, `addTarget`, `updateTarget`, `removeTarget`, `addBuiltin`, `builtinConfig`, `builtinTarget`, `decided`, `managedName`, `noteSetupSeen`, `sessionSecret`
  - URL helpers: `normalizeUrl`, `nameFor`, `cleanName`, `isThisComputer`, `UrlError`
  - Constants: `DEFAULT_HERMES_URL`, `UMBREL_HOST`, `ENV_ID`, `MAIN_ID`, `BUILTIN_ID`, `BUILTIN_NAME`
  - Types: `Env`, `Target`, `Credentials`
- `connection.ts`
  - `handleConnection(req, res, path)`, `hermesFor`, `hermesById`, `requestTarget`, `firstTarget`, `knownTargets`, `instance`, `reload`, `onDrop`, `describe`, `state`, `addNamed`, `cookieFor`, `syncHermesCookie`
  - `HERMES_COOKIE` (`murmur_hermes`), `HERMES_HEADER` (`x-murmur-hermes`), `HERMES_PARAM` (`hermes`)
  - Types: `Connection`, `Body`
- `hermes.ts`: `createHermes(target)` (type `Hermes`), `ConnectError`, `MIN_HERMES_VERSION` (`0.21.4`), `olderThan`, `readCookies`, types `Mode`, `Status`, `ConnectionInfo`.
- `proxy.ts`: `createProxy(pick)`, which returns `proxyHttp`, `proxyUpgrade`, `proxyOAuthReturn` and `closeWhere`. Also exports `refuse(socket, status, text)`.
- `access.ts`: `handleAccess`, `isSignedIn`, `accessRequired`, `cookieValue`, `onSignOut`.
- `http.ts`: `sendJson`, `readJson` (64 KiB default limit), `readCookie`, `appendCookie`, `secure`, `requestUrl`, `hostAllowed`, `originAllowed`.
- `setup.ts`: `handleSetup`, `startSetup`, `setupSettled`.
- `discovery.ts`: `candidates`, `candidate`, `candidateId`, `candidateById`, `parseFindList`, `onUmbrel`, `publicStatus`, `health`, `contents`, `toFoundAgent(s)`, `offer`, `forApp`, `remembered`, `lookAround`, `lookAgain`, `quietState`, `builtinReport`, `builtinInstallId`, `withHiddenToolsets`, constants `AWAY_MS`, `START_PATIENCE_MS`, `RESTART_PATIENCE_MS`, plus the matching types.
- `telegram.ts`: `handleTelegram`, `startTelegram`, `stopTelegram`, `createPairings(deps)`, `StartError`, constants `POLL_MS`, `MAX_BACKOFF_MS`, `SERVICE_TRIES`, `RESTART_TRIES`, types `Phase`, `Pairing`, `Deps`, `TelegramHermes`.
- `oauth-return.ts`: `OAUTH_RETURN`, `isOAuthReturn`, `returnPage`, `sendReturnPage`.
- Settings read from the environment, or from `ServerOptions.env`: `PORT`, `DATA_DIR`, `STATIC_DIR`, `HERMES_URL`, `HERMES_TOKEN`, `HERMES_USERNAME`, `HERMES_PASSWORD`, `HERMES_NAME`, `MURMUR_BUILTIN_HERMES_URL` (with `_USERNAME` and `_PASSWORD`), `MURMUR_PASSWORD`, `MURMUR_SECRET`, `MURMUR_ALLOWED_HOSTS`, `MURMUR_ALLOWED_ORIGINS`, `MURMUR_FIND_HERMES`, `MURMUR_LOCAL_MODEL_URLS`.
- The response shapes the web app reads are in `src/state/setup.ts`.

## Invariants

- Settings are process-wide (`config.ts` `useEnv`). One process runs one Murmur server at a time. Modules must not read settings at import time; derive values with `memo` so they are recomputed when `useEnv` swaps the settings.
- Hermes credentials and session tokens never reach the browser. The proxy strips `cookie`, `authorization`, `origin`, `referer`, `host`, `x-hermes-session-token`, `forwarded`, `x-real-ip`, `x-forwarded-*` and hop-by-hop headers, then attaches auth server-side.
- Only `/hermes/api/*` is proxied. Other `/hermes/*` paths return 404, because Hermes pages carry its token. Markup responses (HTML, SVG, XML) are only allowed for files the person explicitly downloads.
- Request guard order (`app.ts`):
  1. `/healthz` is always answered.
  2. `hostAllowed` blocks DNS rebinding.
  3. The `requireHeader` check runs; only the OAuth return skips it.
  4. `originAllowed` is checked on `/hermes/*` and on every mutating request.
  5. Sign-in is checked before anything else under `/murmur/*`, except the access routes.
  6. WebSocket upgrades get the same checks.
- When `requireHeader` is set, the header is compared in constant time and deleted before forwarding. It is never sent to Hermes.
- Requests wait on `setupSettled()` before routing. The first start after an update may still be migrating the chosen Hermes.
- A tab pinned to a Hermes id (`x-murmur-hermes` header or `?hermes=`) that no longer exists gets `409 hermes_gone`. It never falls back to another Hermes.
- The managed (`HERMES_URL`) entry and the built-in entry cannot be removed.
- `murmur.json` and `telegram.json` are written atomically (temporary file, then rename) with mode `0600`, in a `0700` directory.
- Sign-in cookies are HMAC-signed with a key derived from `sessionSecret()` and `MURMUR_PASSWORD`. Changing the password signs everyone out. Login is rate-limited to 10 tries per IP per 10 minutes.
- Upgraded sockets must have an `error` handler; without one, a socket error crashes the process.
- `requestTimeout` is 0 so long-lived streams are never cut at this hop.

## Side Effects

- Listens on TCP. The port comes from `PORT` (default 3000); `ServerOptions.port` overrides it, and port 0 picks a free one.
- Reads and writes `DATA_DIR/murmur.json`: connections, the generated session secret and setup state. Reads and writes `DATA_DIR/telegram.json`: pending and finished Telegram pairings.
- Makes outbound HTTP and WebSocket calls to Hermes instances: proxying, `/api/status`, `/api/health`, sign-in and token refresh.
- Probes discovery candidates (`MURMUR_FIND_HERMES`, or defaults such as `hermes-agent_web_1:18789` and `localhost:9119`) and local model servers (`ollama_ollama_1:11434`, `localai_api_1:8080`).
- Background timers: Telegram pairing polling, which resumes after a restart, and setup migration on first start.
- Streams static files from `STATIC_DIR` (default `./dist`). It serves the precompressed `.br` or `.gz` sibling when the browser accepts it.
- Logs to the console.

## Verification

- Run: `npm test` (vitest; includes `server/*.test.ts`)
- Typecheck: `npm run typecheck` (`tsconfig.node.json` includes `server/`)
- Against a real Hermes (needs Docker): `npm run test:contract`
