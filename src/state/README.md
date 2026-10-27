# state

## Overview

This directory is Murmur's client-side domain layer. Each module covers one Hermes concept, such as agents, chats, groups, routines, models or vault. It wraps Hermes's JSON-RPC socket and REST API (via `@/hermes/gateway` `rpc`/`gateway` and `@/hermes/rest` `api`) in React Query hooks, zustand stores and plain async actions. Screens and features consume them. Two modules talk to the Murmur server's own `/murmur/*` endpoints instead of Hermes: `connection.ts` and `setup.ts`. Several modules are pure logic with no I/O (`limits`, `local-tiers`, `local-jobs`, `local-hf`); they are covered by the colocated `*.test.ts` files.

## Interface

Grouped by concern. Main exports only; see each file for the rest.

- **Agents (Hermes profiles)**: `agents.ts`
  - Types `Agent`, `Profile`, `AgentInput`, `ChatSummary`, `SessionRow`.
  - Hooks `useAgents`, `useAgent`, `useFreshAgents`, `useInvalidateAgents`, `useAgentChats`. Query key `agentsKey`.
  - Actions `createAgent`, `updateAgent`, `deleteAgent`, `revealAgent`, `fetchSoul`, `fetchAgentChats`.
  - Helpers `toAgent`, `speakerOf`, `composeSoul`, `readSoul`, `slugFor`, `rememberHue`, `toSummary`, `sourceLabel`. Constants `BOT_CHAT`, `MAIN_CHAT`.
- **Live chats**: `chats.ts`
  - `useChats` store (keyed by stored chat id) and `getChat`.
  - `wireChats()`: one-time gateway wiring, called from `src/app.tsx`.
  - Chat lifecycle: `openChat`, `leaveChat`, `createChat`, `send`, `sendHidden`, `resend`, `regenerate`, `undo`, `stop`, `stopHelper`, `retry`, `askAside`, `runSlash`, `continueHere`.
  - Replies to the agent's prompts: `answerApproval`, `answerQuestion`, `answerSecret`.
  - Chat edits: `react`, `renameChat`, `updateChat`, `deleteChat`, `clearUnread`, `setChatModel`, `setChatReasoning`, `resetChatReasoning`.
  - Helpers `attachmentsOf`, `editableMessage`, `titleTaken`, `friendlyError`, `resumeHolding`.
- **Group chats (Hermes hosted rooms)**: `groups.ts`
  - Types `Group`, `GroupMember`, `GroupSummary`, `GroupView`. Constants `MIN_MEMBERS` (2) and `MAX_MEMBERS` (6).
  - Hooks `useGroups`, `useGroupsAvailable`, `useGroup`, `useGroupSummaries`, `useGroupLive`.
  - Actions `createGroup`, `renameGroup`, `deleteGroup`, `sendToGroup`, `stopGroup`, `approveInGroup`, `retryGroup`, `prefetchGroup`. Helpers `handleFor`, `joinNames`.
- **Agent activity and sync**
  - `status.ts`: `wireStatus`, `useAgentStatus`, `useBusyAgents`, `useNeedsYou`, `onChatMoment`, `markChatSeen`, `setViewingChat`, `viewingChat`, `useChatUnread`, `useUnreadCount`.
  - `sync.ts`: `wireSessionLists(qc)` refreshes chat lists on `sessions.changed`.
  - `search.ts`: `useChatSearch`, `useSearchStore`, `searchActions`, `parseSnippet`, `MIN_QUERY`.
- **Per-agent features**
  - `routines.ts`: `useRoutines`, `useBlueprints`, `useRoutineRuns`, `useRoutineNews`, `useRunOf`, `useRoutineActions`, `createFromTemplate`, `createCustom`, `setRoutineEnabled`, `rescheduleRoutine`, `renameRoutine`, `deleteRoutine`, `runRoutineNow`, `useRunningNow`.
  - `memory.ts`: `useMemories`, `useMemoryActions`, `fullMemoryText`, `rememberMessage`.
  - `vault.ts`: `useVault`, `useVaultActions`, `vaultActions`, `readVault`, `toEntries`, `toWire`, `VaultError`, plus card and login helpers (`luhn`, `cardBrand`, `formatCardNumber`, `parseExpiry`, `originOf`, and others).
  - `apps.ts` (catalog MCP apps with OAuth): `useCatalog`, `useAgentApps`, `useAppHealth`, `connectApp`, `connectOnUmbrel`, `cancelConnect`, `setAppEnabled`, `removeApp`, `useConnections`, `returnUrl`.
  - `access.ts` (Telegram/WhatsApp pairing requests): `useAccess`, `useAccessRequests`, `allowRequest`, `removeAllowed`, `ignoreRequest`, `useJustAllowed`.
  - `telegram.ts`: `useTelegram`, `usePairing`, `usePairings`, `startPairing`, `cancelPairing`, `refreshPairings`, `disconnectTelegram`, `botLink`.
  - `whatsapp.ts`: `useWhatsApp`, `useLinks`, `startLink`, `cancelLink`, `disconnectWhatsApp`, `statusFrom`, `linkFrom`, `chatLink`.
  - `insights.ts`: `useWeek`, `summarizeWeek`, `useChatUsage`, `chatUsageOf`, `useContextBreakdown`, `slicesOf`, `money`, `tokensText`.
  - `backups.ts`: `exportAgent`, `importAgent`, `importId`, `freeName`.
- **Models and readiness**
  - `models.ts`: `useModels`, `setMainModel`, `moveOff`, `disconnect`, `connectApiKey`, `connectLocal`, `useLocalServers`, `findServer`, `useChatGPTSignIn`, `adoptChatGPT`, `useCheckReady`, `useRefreshModels`, `useOlderPlanUsage`, `modelName`, `LOCAL_SLUG`.
  - `limits.ts`: `planUsage`, `restingUntil`, `untilText`, `planUsageLine`, `planFromAccountLines`, `reportsPlanAsText`.
  - `readiness.ts`: `useRuntimeCheck`, `useReadiness` (`'loading' | 'ready' | 'needs-welcome' | 'needs-setup' | 'unknown'`), `useWelcomed`, `markWelcomed`, `restartBoot`.
- **Running models on the Hermes host (Hermes 0.22+)**
  - `local-runtime.ts`: `useDeviceModels`, `useDeviceSetup`, `useFindModel`, `useDownloaded`, `removeDownloaded`, `LOCAL_PROVIDER`.
  - `local-tiers.ts`: `PICKS`, `offersFor`, `need`, `held`, `usable`, `startWindow`, `speedOn`, `formatSize`, `FLOOR`, `OVERHEAD`.
  - `local-jobs.ts`: `deviceModels`, `stageOf`, `overall`, `jobFor`, `plainError`, `hardwareOf`.
  - `local-hf.ts`: `parseModelRef`, `quantOf`, `pickFile`, `fitOf`, `hfModel`, `lookupError`, `prettyName`.
- **Background agent config sync**: each module has a `useXSync(agentIds)` hook that runs through `@/lib/upkeep`.
  - `pictures.ts`: `usePictures`, `useSetPictures`, `ensurePicturesFor`, `usePicturesSync`.
  - `timezone.ts`: `ensureTimezone`, `ensureAgentTimezone`, `useAgentTimezone`, `browserTimeZone`.
  - `toolsets.ts`: `HIDDEN_TOOLSETS`, `hideDesktopToolsets`, `useDesktopToolsSync`.
  - `umbrel-context.ts`: `ensureUmbrelContext`, `useUmbrelContextSync`.
  - `umbrel-mcp.ts`: `connectUmbrel`, `disconnectUmbrel`, `ensureUmbrelMcp`, `useUmbrelMcp`, `useUmbrelMcpSync`, `useHermesOnUmbrel`, `findUmbrelKey`, `handoffKey`, `UmbrelKeyError`, `UMBREL_MCP_URL`.
- **Murmur server (not Hermes)**
  - `connection.ts`: `connectionApi`, `connectionsApi`, `useHermesConnection`, `useHermesList`, `useHermesManager`, `switchHermes`, `followSwitches`, `useSwitchCurtain`, `liftCurtain`, `useMurmurSession`, `needsConnectionSetup`.
  - `setup.ts`: `useSetup`, `fetchSetup`, `chooseHermes`, `addFoundHermes`, `useLookAgain`, `useCarryOn`, `pickLead`, `recommended`, `BUILTIN_ID`.

## Invariants

- An agent is a Hermes profile, and the main agent is profile `default`. Murmur's extra metadata (name, colour, hue) lives in the profile's `ui_meta`, the same place Hermes Desktop keeps it. Role and personality live in the profile description and `SOUL.md`. Never add a separate Murmur-only store for them.
- In `chats.ts`, chats are keyed by Hermes's stored session id. The runtime id is only used for RPC and event routing, and it can be reclaimed at any time (`session.reclaimed`). After a reconnect, only chats that are on screen or busy are re-attached.
- `wireChats`, `wireStatus`, `wireSessionLists` and the group wiring are idempotent (guarded by a `wired` flag). Each registers its gateway listeners only once per page.
- Group rooms send no live events. The room log is polled and is the source of truth: summaries refresh every 3 s while a room is live and every 20 s otherwise, and hidden tabs do not poll. Member side-chats only add streaming text.
- Vault secrets (passwords, card numbers, addresses) never enter React Query caches or chats; only metadata is read back. Hermes has no edit, so changing an item adds the new one first and then removes the old one.
- Memory cards are addressed by position. Every edit re-reads the list and finds the card by its text right before writing.
- Background config sync (`pictures`, `timezone`, `toolsets`, `umbrel-context`, `umbrel-mcp`) runs serially at idle time through `upkeep`. Finished agent ids are kept in a `rememberedSet` for 24 h (`murmur:umbrel-asks-not` is kept indefinitely). `timezone` only fills a blank timezone and never replaces one someone chose. `umbrel-context` only copies what the main agent already has.
- The Umbrel MCP handoff key is accepted only if it matches `umbrelmcp_<32 hex>_<64 hex>`. The MCP server URL is always `UMBREL_MCP_URL` and never comes from the link.
- Older Hermes releases are supported. Features that hit JSON-RPC -32601 (see `@/hermes/compat`) are hidden rather than retried.
- Local-storage keys go through `scoped()` from `@/hermes/instance`, so two Hermes instances never share state. Switching Hermes (`switchHermes`) reloads the app.
- Credentials for Hermes never reach the browser. `connection.ts` only sees status and mode from `/murmur/connection`.

## Side Effects

- JSON-RPC over the gateway socket: `rpc(...)` calls and `gateway.onEvent`, `onRequest` and `onState` subscriptions in `chats`, `groups`, `status`, `sync`, `access` and `agents`.
- REST via `api` to `/hermes/api/*`. Covers profiles, sessions, config, cron jobs, MCP servers, local-models jobs, analytics, memory, platform setup and backups.
- `fetch` to the Murmur server: `/murmur/connection(s)`, `/murmur/session`, `/murmur/login`, `/murmur/logout` and `/murmur/setup`. Logout and Hermes switches call `location.reload()`.
- `BroadcastChannel('murmur:hermes')` tells other tabs about a Hermes switch.
- `localStorage` and `sessionStorage`: hues, pending looks, unread and seen marks, welcomed flag, ignored access requests, pairing state, upkeep "done" sets and the switch curtain.
- Writes to agent config on the Hermes host: `config.yaml` (image generation, toolsets, timezone, plugins, skills), MCP servers with the Umbrel key stored in the agent's `.env`, `SOUL.md`, memory files, the vault, cron jobs. It can also restart Hermes messaging or gateway services (timezone, Telegram, WhatsApp).
- `umbrel-mcp.ts` reads a handoff key from the URL fragment at import time and scrubs it with `history.replaceState`.
- `apps.ts` opens OAuth sign-in tabs or windows.
- Timers: group and log polling, debounced list invalidation, pairing and link polling.

## Verification

- Run: `npm test` (vitest; colocated `*.test.ts` cover access, apps, backups, insights, limits, local-hf, local-jobs, local-tiers, pictures, setup, toolsets, umbrel-context, umbrel-handoff, umbrel-mcp, vault, whatsapp and whatsapp-link)
- Run: `npm run typecheck`
