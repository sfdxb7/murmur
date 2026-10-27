Vendored from NousResearch/hermes-agent `apps/shared/src` at tag **v0.22.0**
(Hermes v0.22.0, the version Murmur bundles). MIT licensed,
© Nous Research: `LICENSE` is upstream's notice and must stay with these files.

These are Hermes's own typed JSON-RPC client and the generated wire contract
used by Hermes Desktop and the dashboard. Do not edit by hand — re-copy from
the matching Hermes tag when the bundled Hermes is bumped, then run
`npm run typecheck` to surface any contract drift.

## Interface

Upstream code. Murmur imports the client through `../gateway.ts`; `src/state/vault.ts` also imports wire types (`VaultItem`) straight from `gateway-contract.generated.ts`.

- `json-rpc-gateway.ts`
  - `JsonRpcGatewayClient`: WebSocket JSON-RPC client. Methods: `connect(wsUrl)`, `close()`, `invalidate(message?)`, `request<T>(method, params?, timeoutMs?)`, `on(type, handler)`, `onAny`, `onEvent`, `onRequest`, `onState`, `getSeqWatermarks()`, `sessionReplayBarrier(sessionId)`; getter `connectionState`.
  - `GatewayEventHub`: typed event fan-out (`on`, `onAny`, `dispatch`).
  - `isGatewayWebSocketUrl(value)`, `APPROVAL_RESPOND_TIMEOUT_MS` (300 s).
  - Types: `ConnectionState` (`'idle' | 'connecting' | 'open' | 'closed' | 'error'`), `GatewayClientOptions`, `WebSocketLike`, re-exported `GatewayEvent`, `GatewayEventName`.
- `json-rpc-channel.ts`
  - `JsonRpcRequestChannel`: transport-agnostic request/response matching, server-to-client requests and heartbeat (`attach`, `detach`, `owns`, `request`, `onRequest`, `deliverRequest`, `handleFrame`, `startHeartbeat`, `stopHeartbeat`).
  - `JsonRpcGatewayError`, `jsonRpcErrorFromFrame`, `wireFrameText`.
  - Constants: `JSON_RPC_METHOD_NOT_FOUND` (-32601), `JSON_RPC_INTERNAL_ERROR` (-32603), `JSON_RPC_SESSION_NOT_SHOWN` (4404), `DEFAULT_HEARTBEAT_INTERVAL_MS` (15 s), `DEFAULT_HEARTBEAT_DEADLINE_MS` (45 s).
  - Types: `GatewayRequestId`, `JsonRpcFrame`, `JsonRpcErrorPayload`, `JsonRpcTransport`, `JsonRpcRequestChannelOptions`, `ServerRequest`, `ServerRequestParams`, `ServerRequestHandler`, `HeartbeatLiveness`.
- `gateway-events.ts`: re-exports the whole generated contract plus `GatewayEventMap`, `ClientLocalGatewayEventMap`, `GatewayEventName`, `GatewayEvent<K>`, and `BACKEND_EVENT_NAMES` (alias of `GATEWAY_EVENT_TYPES`).
- `gateway-contract.generated.ts`: generated wire types (about 780 exports: request params/results and event payloads) and the `RPC_METHODS`, `SERVER_REQUEST_METHODS` and `GATEWAY_EVENT_TYPES` name arrays.

## Invariants

- Files are byte-for-byte copies of upstream at the tag above. Murmur-specific behaviour belongs in `../gateway.ts`, `../rest.ts` or `../compat.ts`, never here.
- `LICENSE` must ship alongside these files (MIT attribution).
- The vendored tag must match the Hermes version Murmur bundles; a mismatch shows up as type errors in `npm run typecheck`.
- `JsonRpcGatewayClient.connect()` only accepts `ws://` or `wss://` URL strings and rejects anything else.
- After a reconnect the client fetches `session.events.since` from per-session seq watermarks, so events are not dropped or delivered twice. A changed server epoch resets the watermarks.

## Side Effects

- `JsonRpcGatewayClient.connect()` opens a browser `WebSocket` (or one from `socketFactory`) and sends JSON-RPC frames over it.
- Timers: request timeouts (120 s default, 300 s for `approval.respond`), a 15 s connect timeout, a 10 s replay timeout and a heartbeat interval. A missed heartbeat deadline invalidates the socket.
- On reconnect it sends replay requests (`session.events.since`) and holds back live frames until the replay arrives.
- No disk, storage or global state outside the client instance.

## Verification

- Run: `npm run typecheck` (catches contract drift after a re-copy)
- Run: `npm test`
