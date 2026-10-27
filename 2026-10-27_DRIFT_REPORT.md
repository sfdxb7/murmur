# EGM Drift Report: 2026-10-27

This report compares the 43 EGM contract READMEs written on 2026-10-27 against the source code. It lists only the places where they differ. Six read-only reviewers checked the contracts statically. Nothing was run or edited.

## src/README.md

- The lazy-screen invariant says all six rare screens are "preloaded when idle", but `ChatsScreen` is lazy (src/app.tsx:42) and left out of `preloadWhenIdle(...)` (src/app.tsx:59).
- The `/` (home) route is a catch-all `<Route>` with no path (src/app.tsx:112), so any unmatched URL renders `HomeScreen`.
- "Phone pages are wrapped in `Pushed` or `SwipeBack`" is overstated: `/settings/:section?` and `/welcome/:step?` render without either (src/app.tsx:110-111).
- The layering note ("state imports types and pure helpers back from features") is understated: `src/state/models.ts:12` imports `freshenModels`, which does REST I/O (src/features/model/use-models.ts:17-21); `src/state/chats.ts:18` imports `toolMedia`; `src/state/agents.ts:18` imports `personalityPrompt` from a React component file (src/features/agents/agent-editor.tsx:85).
- "Features render state, and state talks to hermes" doesn't hold: features and screens call `@/hermes/gateway` or `@/hermes/rest` directly (src/features/model/use-models.ts:2-3, src/features/chat/notices.ts:7, src/features/notifications/routine-runs.ts:7-9, src/features/voice/speech.ts:8, src/features/agent-page/chats.ts:5, src/features/commands/use-catalog.ts:3, src/screens/settings.tsx:9).
- Side Effects list timezone among background sync hooks; `ensureTimezone()` is a one-shot effect gated on `Boolean(agents)` (src/app.tsx:271-273).
- Undocumented app-wide side effect: global keyboard shortcuts via `useShortcuts` and `ShortcutsSheet` (src/app.tsx:73, :269).

## src/state/README.md

- The idempotency invariant is wrong for `wireSessionLists`: no `wired` guard, adds a new `gateway.onEvent` listener per call (src/state/sync.ts:14-16). Only access, chats, groups and status have the guard (src/state/access.ts:69, chats.ts:1654, groups.ts:784, status.ts:94).
- "Member side-chats only add streaming text" is wrong: side-chat runtimes also deliver approval requests turned into room approvals (src/state/groups.ts:756-781), and `approval.cancelled` is handled (src/state/groups.ts:664).
- The open room's own log poll is undocumented: 800 ms fast and 5 s slow (src/state/groups.ts:93-94, :424), with a 3 s fast window on reconnect (:811) and re-poll on `visibilitychange` (:812-815). The contract only gives the 3 s / 20 s summary interval.
- "Local-storage keys go through `scoped()`" is violated: `'murmur:welcomed'` (src/state/readiness.ts:56), `'murmur:local-setup'` (src/state/local-runtime.ts:67), `'murmur:switching'` in sessionStorage (src/state/connection.ts:187).
- "Each module has a `useXSync(agentIds)` hook" is false for `timezone.ts` (exports `ensureTimezone`, `ensureAgentTimezone`, `useAgentTimezone`; src/state/timezone.ts:126, 147, 177).
- "Background config sync runs serially through `upkeep`" is overstated: `useAgentTimezone`'s queryFn calls `ensureAgentTimezone`, which can write config and restart the runner outside `upkeep` (src/state/timezone.ts:126-139, 177-184); `ensureUmbrelContext` and `ensureAgentTimezone` are also called directly.
- "Finished agent ids are kept for 24 h" is not per id: `rememberedSet` stores one timestamp for the whole set and drops every id when it expires (src/lib/upkeep.ts:30-38, 53).
- "Two modules talk to the Murmur server" is wrong: `telegram.ts` calls `/murmur/telegram`, `/start`, `/cancel` (src/state/telegram.ts:215, 275, 293); `models.ts` calls `/murmur/local` (src/state/models.ts:261); Side Effects also omit `/murmur/connection/test` (src/state/connection.ts:87).
- "Hermes switches call `location.reload()`" is wrong: they call `location.replace('/')` after a 520 ms curtain hold (src/state/connection.ts:224, 189).
- `connection.ts` sees more than status and mode: `HermesConnection` carries `url`, `username`, `hermesVersion`, `minVersion`, `source`, `managed`, `error` (src/state/connection.ts:18-40); Hermes passwords are sent from the browser in `ConnectionRequest` and setup `Choice` (src/state/connection.ts:45, src/state/setup.ts:192, 229-231).
- The "secrets never in the browser" framing fails for the Umbrel MCP key: `mainKey()` reveals it via `/api/env/reveal` (src/state/umbrel-mcp.ts:183).
- REST is not always through `api`: `backups.ts` uses raw `fetch('/hermes/api/files/upload-stream')` (src/state/backups.ts:81) and a download link (:43).
- Omitted REST endpoints: `/api/env`, `/api/env/reveal` (src/state/models.ts:77, 249; src/state/umbrel-mcp.ts:183), `/api/providers/*`, `/api/model/*` (src/state/models.ts), `/api/files` (src/state/backups.ts:76), `/api/tools/toolsets/*`, `/api/gateway/restart` (src/state/timezone.ts:101), `/api/status`.
- Exports never mentioned (beyond "main exports only"): routines (`useDeliveryTargets`, `fetchRoutineRuns`, `knowRun`, `runOf`, `useJobRuns`, `fetchRunResult`, `useContinuedRuns`, `refreshRoutines`, query keys); chats (`dismissItem`, `Chat`, `Goal`, `ChatChange`); groups (`GroupActivity`); apps (`arrange`, `healthOf`, `useConnection`, `friendlyError`, `openSignInTab`, `showSignIn`, `nextStep`, `onUmbrel`, `tokenError`, `cleanToken`, `clearConnection`); access (`accessFrom`, `waiting`, `platformName`, `personName`); agents (`readable`, `placeLastChats`); setup (`isBuiltinId`, `waitingOn`, `holdsSomething`, `orderedAgents`, `agentNames`, `plural`, `countLine`); telegram (`pairingActive`, `effectivePhase`, `clearPairing`); whatsapp (`linkActive`, `phoneLabel`); umbrel-mcp (`UMBREL_SERVER`, `clearHandoffKey`, `maskKey`, `umbrelSettingsUrl`, `umbrelMcpKey`, `stopAskingFirst`); umbrel-context (`UMBREL_PLUGIN`, `umbrelContextOf`, `umbrelContextPatch`); toolsets (`murmurDisplay`, `withHiddenToolsets`); timezone (`readTimezone`, `agentZone`); local-hf (`needOf`, `heldOf`, `hueOf`, `fitLine`); local-tiers (`Q8`, `inRam`, `stagedId`); local-jobs (`UNSUPPORTED`); insights (`dayKey`, `contextWorthShowing`); pictures (`nextDefer`); models (re-exports `planUsageLine`, `PlanUsage`); query-key constants generally.

## src/hermes/README.md

- `api.get` is `(path, init?)` with no body, not `(path, body?, init?)` (src/hermes/rest.ts:78).
- "Every REST request carries the tab's Hermes id" is false for streamed file URLs: `fileUrl` (src/features/media/files.ts:100), `fetchOk` (src/features/media/files.ts:115, 228) and backup downloads (src/state/backups.ts:43) send no `x-murmur-hermes` or `?hermes=` and fall back to the cookie. The header is also omitted whenever `tabHermes()` is null (src/hermes/rest.ts:22-23, gateway.ts:15-16).
- `murmur:hermes-gone` for a cookie/tab mismatch fires only inside a failed dial (src/hermes/gateway.ts:45-46); the "whenever the cookie differs" check lives in `followSwitches` in src/state/connection.ts.

## src/hermes/vendor/README.md

- The heartbeat timer is conditional: it starts only when `gateway.ready` advertises `heartbeat: true` (src/hermes/vendor/json-rpc-gateway.ts:424; json-rpc-channel.ts:521-523).
- `JsonRpcRequestChannel` interface list omits public getters `defaultRequestTimeoutMs` and `connected` (src/hermes/vendor/json-rpc-channel.ts:220, 224).

## README.md (Murmur Blueprint)

- "Hermes access tokens and credentials never reach the browser" is overstated: the Umbrel MCP bearer key is read into the browser through `/api/env/reveal` (src/state/umbrel-mcp.ts:183); Hermes passwords and provider API keys are posted from the browser (src/state/connection.ts:45, src/state/models.ts:249).
- "Both [channels] name the tab's pinned Hermes" is broken by `/hermes/api/fs/download` and `read-text` URLs with no Hermes id (src/features/media/files.ts:100, 228; src/state/backups.ts:43).
- "Screens hold no domain logic": src/screens/settings.tsx:388 runs `api.get('/api/status')`; screens import `@/hermes/gateway` directly (src/screens/chat.tsx:35, src/screens/connection-banner.tsx:4).
- "The server rejects requests from disallowed origins" is partial: the origin check runs only for `/hermes*` or mutating requests, so GETs to `/murmur/*` skip it (server/app.ts:244), and a request with no `Origin` header always passes (server/http.ts:98).
- Global Side Effects omit the desktop shell's `userData/desktop.json` (desktop/state.ts:1).
- Root files not covered: `Dockerfile`, root `docker-compose.yml` (which also pins the Hermes image, docker-compose.yml:33), `.env.example`, `tsconfig*.json`. The image-match invariant names only the umbrel and dev compose files.

## src/features/chat/README.md

- The playground has an eighth scene, `secrets`, missing from the contract's list (`solo|live|group|empty|media|cards|errors`) (src/features/chat/playground.tsx:20, :301).
- Notice dedupe has an undocumented 60 s window (`AGAIN_MS`): an identical notice with the same key is suppressed only for 60 s. Keys fall back to `id`, then text; `kind: 'sticky'` never times out; `ttl_ms` sets toast duration; dismissal event is `notification.clear` (src/features/chat/notices.ts:11, :19-24, :45).
- `useKeyboardInset` does more than "read the visual viewport": it appends a hidden `100dvh` probe `<div>` to `document.body`, attaches a ResizeObserver plus `resize`/`scroll` listeners (src/features/chat/use-keyboard-inset.ts:18-20, :31-35), and reports 0 unless the covered height exceeds 150 px and the page isn't pinch-zoomed (:27).
- `composer.tsx` hosts the slash-command palette (`commands`, `extraCommands`, `onCommand`, `commandCurrent`) and voice dictation (microphone) from `@/features/voice/dictation`; neither is in Interface or Side Effects (src/features/chat/composer.tsx:21-25, :54-60). `ComposerHandle` also exposes `focus` (:31-35).
- `message-actions.tsx` reads replies aloud through `@/features/voice/speech` (`toggleSpeaking`), not listed (src/features/chat/message-actions.tsx:5).
- `message-menu.tsx` and `reactions.tsx` add a window `resize` listener as well as `keydown` (src/features/chat/message-menu.tsx:88, src/features/chat/reactions.tsx:60); vibration happens in `useLongPress`, not only while the menu is open (message-menu.tsx:32).
- `umbrel-key.tsx` only steps in when Hermes runs on Umbrel (`useHermesOnUmbrel`), invalidates the `['umbrel-mcp']` query after connecting and hides the card after 2800 ms (src/features/chat/umbrel-key.tsx:42, :62, :64, :74).
- "Components render the `types.ts` view model" doesn't hold for `mention-card.tsx` and `mention.tsx`, which read live stores (`useAgent`, `useAgentStatus`, `useAgents`); `mention-card.tsx` also calls `navigate` (src/features/chat/mention-card.tsx:9-11, src/features/chat/mention.tsx:13).

## src/features/chat-screen/README.md

- `relativeDay` takes epoch ms plus optional `now`, not a `date`; returns `''` for 0 and adds the year outside the current year (src/features/chat-screen/relative-day.ts:2-3, :12).
- The context ring shows at 50% or more, not "more than half full": `(u?.context ?? 0) >= 50` (src/state/insights.ts:139).
- `ChatMenu` itself only provides "Copy chat" and "Share…"; info, pin, rename, archive and delete come from the caller via `useChatMenu`'s `more` (src/features/chat-screen/chat-menu.tsx:27, :49-53). A failed share falls back to copying (:46); the menu also opens on press-and-hold (:57-73) and adds a window `resize` listener (:118).
- Data sources incomplete: `chat-name.ts` reads `useArchivedChats` from `@/features/agent-page/chats` (direct `/api/sessions` via `api`) and `runTitle` from `@/features/routines/runs` (src/features/chat-screen/chat-name.ts:5-6, src/features/agent-page/chats.ts:5, :158-160).
- Side Effects omits `elsewhere.tsx` toasts (5000 ms, navigate on "View"; group approvals from `useGroupLive`) (src/features/chat-screen/elsewhere.tsx:34-40, :126-141).
- The title wait is a fixed 6000 ms (`TITLE_WAIT`), only for chats started here (src/features/chat-screen/chat-name.ts:9, :45-49).

## src/features/media/README.md

- `toolMedia` is `toolMedia(name, result): string[]`, can return several images including http(s) URLs, and skips tools matching vision/analyze/browser_/read_file/search (src/features/media/tool-media.ts:5-8, :21-23).
- The upload-name map in `localStorage` is capped at the newest 300 entries (src/features/media/parse.ts:233-238).
- `PreviewFrame` sends a widget prompt only if the iframe has focus or was touched in the last 5000 ms, at most once per 1000 ms, then blurs the iframe (src/features/media/preview-frame.tsx:185-190).
- Unlisted listeners: `preview-frame.tsx` adds window `message`, `blur`, `murmur:theme` and a matchMedia `change` listener (src/features/media/preview-frame.tsx:150-151, :167, :197); `lightbox.tsx` adds `resize` and non-passive `wheel` (src/features/media/lightbox.tsx:105, :409).

## src/features/commands/README.md

- "Anything else typed after a slash is sent to Hermes unchanged" is overstated: `Catalog.elsewhere` blocks commands Hermes marks `terminal`/`messaging` plus a hard-coded `BLOCKED` list (src/features/commands/use-catalog.ts:12-19, :32, :46-51), and the chat screen refuses unknown and blocked names with a toast (src/screens/chat.tsx:305-312).
- Undocumented: the `Catalog` shape (`canon`, `elsewhere`), the curated `OFFERED` set (compress, queue, subgoal, refine, usage, version), the `profile` parameter and the 10-minute `staleTime` (src/features/commands/use-catalog.ts:22-29, :35-39).
- `ShortcutsSheet` lists "Search chats" (`mod+k` or `/`), but `useShortcuts` doesn't handle it; `screens/home.tsx` uses `metaKey || ctrlKey`, so Ctrl+K also works on a Mac, contradicting "Shortcuts use `mod`" (src/features/commands/shortcuts.tsx:43, :129-162, src/screens/home.tsx:430).
- `useShortcuts` also handles `mod+,` (settings) and ignores keys while another dialog or menu is open (src/features/commands/shortcuts.tsx:84-87, :142, :146).

## src/features/group/README.md

- "No network or storage access" is false: `GroupComposer` keeps drafts through `useDraft` (`localStorage` `murmur:draft:*`) (src/features/group/group-composer.tsx:19, :59, src/features/chat/use-draft.ts:20).
- `GroupComposer` uses `useKeyboardInset` (sets `--keyboard`, scrolls the window) (src/features/group/group-composer.tsx:20, src/features/chat/use-keyboard-inset.ts:48-49).
- `group-sheet.tsx` shows `sonner` toasts (src/features/group/group-sheet.tsx:3).
- Mention helpers recognise `@everyone` and `@all` (`mentionedIds` returns every member); `mentionRanges` skips mid-word matches such as emails (src/features/group/mentions.ts:10, :53, :69-70, :78-81).

## src/features/home/README.md

- Missing `localStorage` key: `murmur:chatted` (src/features/home/install-tip.tsx:17, :71).
- The install tip writes `murmur:tip-dismissed:install` as soon as it first becomes eligible, so it shows on one visit only, dismissed or not (src/features/home/install-tip.tsx:95-100).
- Install-tip also listens for `appinstalled` (:63), subscribes to `useChats` at module load (:67-74) and calls `preventDefault()` on `beforeinstallprompt` (:59).
- `actions.tsx` also imports/exports agents (`useImportAgent`, `exportWithToast`), reads and writes the agent's soul (`fetchSoul`, `composeSoul`, `readSoul`) and shows toasts (src/features/home/actions.tsx:7, :15-19, :54, :72, :97-98, :109).
- Roster order is more than "newest activity first": a busy agent or live group counts as now, a new agent counts from creation, and the main agent wins ties (src/features/home/roster.tsx:84-97).

## src/features/agent-page/README.md

- `ChatActions` returns `pin`, `archive`, `unarchive`, `rename`, `remove` and `away`; there is no `delete` member (src/features/agent-page/chats.ts:351).
- Delete is deferred behind a 5000 ms Undo (`UNDO_MS`), hiding the chat meanwhile; `pagehide` and `visibilitychange` listeners commit pending deletes (src/features/agent-page/chats.ts:185, :198-206, :308-349).
- `GET /api/sessions` is called twice with fixed limits: `limit=60&order=recent` (src/features/agent-page/chats.ts:57) and `archived=only&limit=100` (:159).
- Swipe actions are more varied than "right to pin, left to archive": no actions for the main chat and routine results, delete-only for routine runs, Unarchive for archived chats, and on older Hermes without filing, left deletes and there is no pin (src/features/agent-page/chat-list.tsx:233-248).
- Side Effects omits the model-sheet write through `useSetAgentDefault` (src/features/agent-page/model-sheet.tsx:11, :26).
- Unlisted listeners: capturing document `scroll` in `chat-list.tsx` (:105) and window `resize` in `scroll.ts` (:41).

## src/features/agents/README.md

- "A taken name is reported in place (`Taken`)" — no such check exists: `canSubmit` only checks non-empty (src/features/agents/agent-editor.tsx:117); `Taken.names` only filters suggestions and `Taken.ids` only feeds `slugFor` (:119-120, :296, :317-318).
- "Invalidates `agentsKey` after changes" is overstated; only import does (src/features/agents/import-agent.tsx:22).
- `NewGroupSheet` enforces 2 to 6 members (`MIN`/`MAX`), not mentioned (src/features/agents/new-group.tsx:14-15, :44).
- Unlisted: the editor uses `useKeyboardInset` (agent-editor.tsx:22); the preview settles after 650 ms or at once while saving (:300-305); import accepts only `.gz`/`.tgz` (import-agent.tsx:42).

## src/features/search/README.md

No drift detected.

## src/features/access/README.md

- "Allow, ignore and remove change the agent's access list on Hermes" (README.md:22): only allow and remove call Hermes (`POST /api/pairing/approve`, `/api/pairing/revoke`; src/state/access.ts:131, 159). `ignoreRequest` is local: it writes scoped `murmur:access-ignored` to `localStorage` for 1 h (`KEEP_MS`) (src/state/access.ts:177-200). Neither key nor expiry is documented.
- `RequestCard` vibrates only after `allowRequest` succeeds, not on tap (src/features/access/request-card.tsx:38-39).
- Undocumented `sonner` error toasts on allow/remove failure (request-card.tsx:41, people.tsx:117, 151).
- `People` has an undocumented "Not now" button calling `ignoreRequest` (people.tsx:105) and a two-tap remove whose confirm resets after 3.5 s or on blur (people.tsx:128-160).
- Receipt lifetime is `RECEIPT_MS = 1_600` (src/state/access.ts:127, 137-142), not stated.
- `PlatformGlyph` depends on the telegram and whatsapp glyphs and supports only those two platforms (platform-glyph.tsx:1-2, 7-9).

## src/features/apps/README.md

- `AppsSheet` can share an app to other agents ("Also for", `AlsoFor`/`ShareChip` calling `connectApp`) (apps-sheet.tsx:868-946); not listed.
- Side Effects omit `showSignIn` (apps-sheet.tsx:34, 633), which calls `window.open` everywhere including the desktop app (src/state/apps.ts:239-248), contradicting "only `openSignInTab` opens tabs, and only in the browser".
- Other undocumented side effects: navigates to `/settings/umbrel` (apps-sheet.tsx:191-194); confirm dialog via `@/features/settings/ask` before removal (:44, 703-711); `haptic('success')` (:597); `sonner` toasts (:310, 700, 902, 906); clears finished/failed connections 400 ms after close (:65-77).
- Invariant "all state comes from `src/state/apps.ts` and `src/state/umbrel-mcp.ts`" omits `useAgents` from `src/state/agents` (apps-sheet.tsx:21, 872).
- `AppsGlyph` draws `UmbrelIcon` for `UMBREL_SERVER` and shows at most 4 apps (apps-glyph.tsx:13-20); not mentioned.

## src/features/connection/README.md

- `HermesGate` has a fifth outcome: it shows `HermesConnectionForm` when `needsConnectionSetup(connection)` holds (gate.tsx:142-150; src/state/connection.ts:261-264).
- `gate.tsx` reloads only when adopting a named Hermes fails (`if (named && !tabHermes() && !adoptHermes(named)) location.reload()`, gate.tsx:44-45), not whenever it adopts one.
- `AccessGate` also calls `followSwitches()` once (gate.tsx:34-38), adding BroadcastChannel, `visibilitychange` and `HERMES_GONE` listeners that can leave or reload the app (src/state/connection.ts:250-257), and always renders `SwitchCurtain` (gate.tsx:25).
- Server routes are not limited to `/murmur/connection*` and `/murmur/setup`: sign-in calls `/murmur/session` and `/murmur/login` (gate.tsx:31; src/state/connection.ts:278, 297).
- `gate.tsx` refetches the connection every 1.5 s while the built-in Hermes is ready but not connected (gate.tsx:100-104).
- Nearby candidates are not "checked once": `useNearbyHermes` re-probes on each `round` change (nearby.tsx:137-155), reuses answers for 10 s (`REUSE_MS`, :111-120), times out each probe at 4 s (`PROBE_MS`, :30, 125), uses a hardcoded candidate list (:21-27) and merges server `GET /murmur/setup` results (:18-19, hermes-connection-form.tsx:126-128).
- `NoHermesSheet` does no re-checking on close (no-hermes.tsx:32-53); its parent does (src/features/onboarding/setup-flow.tsx:266-275).
- `ConnectionPlayground` does not always use fake answers: `view=live` renders the real form (playground.tsx:135), and the fake server passes unmatched requests to real `fetch` (:110, 127).
- `switcher.tsx` reads `useConnection` from `@/hermes/gateway` (switcher.tsx:7, 81); the README names only `src/hermes/instance.ts`.
- Undocumented: `HermesPicker` navigates to `/settings/hermes` (switcher.tsx:127-132); `CurtainLift` holds at most 8 s (`HOLD_MAX_MS`, curtain.tsx:71, 89); the form adds a window `keydown` Escape listener (hermes-connection-form.tsx:217-226) and confirms before "Forget this server" (:11, 477-483).

## src/features/memory/README.md

- The sheet never stops watching early: `watchUntil` runs the full 45 s (memory-sheet.tsx:131-133), and `useMemories` polls every 4 s regardless (src/state/memory.ts:40-47). The 4 s poll is undocumented.
- The capturing Escape listener is added only while a memory is being edited, not whenever the sheet is open (memory-sheet.tsx:435-445).
- The sheet doesn't send the remember request; it calls an optional `onRemember` prop and hides the field without it (memory-sheet.tsx:28-33, 127-137).
- Undocumented `sonner` toasts on forget/edit/forget-all failure (memory-sheet.tsx:68, 79, 90); `navigator.vibrate` runs only on long-press (:328-330).

## src/features/model/README.md

- Toasts appear only for "make default" (`useSetAgentDefault`) (model-sheet.tsx:61-71), not for every saved change.
- `POST /api/model/set` always sends `scope: 'main'` and the agent `profile` (use-models.ts:94); setting a default invalidates `['agents']` (:98-102). Undocumented.
- `useModelOptions` hides unauthenticated, empty and virtual `moa` providers (use-models.ts:62) and uses a 5-minute `staleTime` (:55, 85). Undocumented.
- `freshenModels` refreshes once per page load per path and forgets failed paths for retry (use-models.ts:17-22).

## src/features/notifications/README.md

- Overview omits group notifications: a group round ending with something new also notifies (notify.tsx:95-105, compose.ts:71-80).
- `routine-runs.ts` also re-checks on a 60 s timer (`EVERY_MS`), debounces events 1.5 s (`SETTLE_MS`), and re-checks when notifications toggle (routine-runs.ts:68-71, 127-139).
- `GET /api/cron/jobs` is called only for agents with newly landed runs, not for each agent (routine-runs.ts:95-96).
- Unlisted Hermes calls: `listProfileNames()` per check (routine-runs.ts:8, 114); `runOf` → `GET /api/sessions/:id` per landed run (:98; src/state/routines.ts:284-288); `fetchRunResult` → `GET /api/sessions/:id/messages` (:101; src/state/routines.ts:360-364).
- Routine watching does nothing while notifications are off and clears its memory (routine-runs.ts:110); not stated.
- Undocumented: `sonner` toast when permission is blocked (notify.tsx:122-124); `visibilitychange` and `navigator.permissions` listeners (notifications.ts:95-99); `focusWindow()` plus navigation on click (:107-110); "Not now" saves `off` (notify.tsx:126-129).

## src/features/onboarding/README.md

- "Connect to Hermes" is shown when this Murmur has no built-in Hermes (`noBuiltin`) or the person picks "other", not "when no Hermes was found" (setup-flow.tsx:151, 219-222, 229-232).
- Undocumented `setup-flow.tsx` side effects: `window.location.replace('/welcome')` when adoption fails (:100-102, 248); a capturing listener that swallows `HERMES_GONE` (:76-80); `restartBoot()` and broad query invalidation on hand-over (:104-110); 1.5 s setup and connection polling (:296, 321); `markArrived` (:129-131).
- `setup-flow.tsx` imports `@/hermes/instance` directly (`adoptHermes`, `HERMES_GONE`, `HERMES_HEADER`, `tabHermes`) (setup-flow.tsx:5).
- Getting ready is also rendered as internal `readying` state inside `SetupFlow`, not only by the gate (setup-flow.tsx:135-146, 287-307).
- `Bloom` always renders DOM and is hidden only by CSS `motion-reduce:hidden` (bloom.tsx:11).
- Undocumented: `haptic('tick')` (where.tsx:134, arrived.tsx:104); `sonner` toasts (where.tsx:147, 180); `GettingReady` timers of 45 s slow, 4 min stuck, 10 s failure hold (getting-ready.tsx:20-25).

## src/features/README.md

- The overview's list of direct `src/hermes` usage is incomplete. It names only `api` (rest.ts) and `gateway`/`rpc` (gateway.ts). Features also import:
  - from `instance.ts`: `tabHermes`, `adoptHermes`, `browserHermes`, `scoped`, `HERMES_GONE` and `HERMES_HEADER` (src/features/settings/hermes-section.tsx:13, src/features/connection/gate.tsx:5, src/features/connection/switcher.tsx:8, src/features/onboarding/setup-flow.tsx:5, src/features/chat/use-draft.ts:2, src/features/media/parse.ts:203)
  - from `compat.ts`: `listProfileNames` (src/features/notifications/routine-runs.ts:8)
  - from `rest.ts`: `HermesError` (src/features/settings/local-service.tsx:7)
  - from `gateway.ts`: `startGateway` and `useConnection` (src/features/routines/harness.tsx:5, src/features/connection/switcher.tsx:7)
- The overview describes a one-way layering ("Features render data from `src/state`"), but `src/state` also imports from features: src/state/routines.ts:16-27, src/state/agents.ts:18-23, src/state/chats.ts:13-18, src/state/groups.ts:16-21, src/state/models.ts:10-12, src/state/status.ts:12, src/state/insights.ts:9. The dependency runs both ways, and the index does not say so.

## src/features/routines/README.md

- Side Effects leaves out that `harness.tsx` talks to Hermes directly. It calls `startGateway()` and the gateway RPC `profiles.list` (src/features/routines/harness.tsx:5, :36, :40).
- "`schedule.ts` reads `navigator.language` to choose … 12- or 24-hour time" is inaccurate. Only `firstDayOfWeek` reads `navigator.language` (src/features/routines/schedule.ts:356, :364). `uses12Hour` uses `Intl.DateTimeFormat(undefined, …)`, the runtime default locale (src/features/routines/schedule.ts:369-372).
- The Overview says data comes from `src/state/routines.ts`, but the dependency is circular and the contract does not mention it. `src/state/routines.ts` imports this feature's `schedule.ts` helpers and `runs.ts` helpers (src/state/routines.ts:16-27). `src/state/agents.ts:23` and `src/features/agent-page/chats.ts:11` also import `runs.ts`.

## src/features/settings/README.md

- The Overview's list of state sources is incomplete: `hermes-section.tsx` uses `src/state/setup.ts` (src/features/settings/hermes-section.tsx:23); `local-service.tsx` and `umbrel-section.tsx` use `src/state/agents.ts` (local-service.tsx:8, umbrel-section.tsx:13); `models-section.tsx` uses `src/state/limits.ts` (models-section.tsx:11); `local-service.tsx` uses `src/state/local-tiers.ts` (local-service.tsx:11). It also imports `src/hermes` directly: `tabHermes` (hermes-section.tsx:13) and `HermesError` (local-service.tsx:7).
- Side Effects says `hermes-section.tsx` only "adds and switches" Hermes servers. It also edits, removes and renames them through `useHermesManager` (src/features/settings/hermes-section.tsx:342, :379, :399, :416), and adds found Hermes servers through `addFoundHermes` (:171).
- Side Effects leaves out the pictures toggle. `PicturesRow` uses `useSetPictures` (src/features/settings/pictures-row.tsx:6), which changes Hermes configuration for the main agent and then every other agent, and calls the `image.generate` probe RPC (src/state/pictures.ts:130-150).

## src/features/telegram/README.md

- The contract never says that `TelegramSheet` embeds `People` from `src/features/access` (src/features/telegram/telegram-sheet.tsx:29, :561), which allows, ignores and removes people through `src/state/access.ts` (src/features/access/people.tsx:9-18, :149). The Invariants list only `src/state/telegram.ts` symbols and Side Effects omits the access changes.

## src/features/templates/README.md

- The contract leaves out the import path: `NewAgentSheet` takes an `onImport` prop and shows an Import action (src/features/templates/new-agent-sheet.tsx:33-34, :3).
- `TemplateGrid` takes a `columns` prop (2 or 3) (src/features/templates/template-grid.tsx:22, :26), not mentioned.

## src/features/vault/README.md

- "`VaultSheet`, which lists, adds and removes vault entries" leaves out editing. Saving over an existing entry calls `actions.replace` (src/features/vault/vault-sheet.tsx:489), which adds the new item and then removes the old one (src/state/vault.ts:210-219), calling the RPC `vault.add` (src/state/vault.ts:188), which Side Effects does not name.
- The Invariants list of `src/state/vault.ts` helpers is incomplete; the sheet also uses `cardFromLabel`, `digitsOf`, `formatExpiry`, `hostOf` and `originOf` (src/features/vault/vault-sheet.tsx:16-33).

## src/features/voice/README.md

- The contract lists `Dictation` under "Components", but it is a type: `export type Dictation = ReturnType<typeof useDictation>` (src/features/voice/dictation.tsx:25).
- "Over plain HTTP, `canDictate` is false" understates the check: it also needs `navigator.mediaDevices.getUserMedia` and `MediaRecorder` (src/features/voice/dictation.tsx:19-23).

## src/features/whatsapp/README.md

- The contract never says that `WhatsAppSheet` reuses the `QrCode` component from the telegram feature (src/features/whatsapp/whatsapp-sheet.tsx:31, :316).
- The contract never says that `WhatsAppSheet` embeds `People` from `src/features/access` (src/features/whatsapp/whatsapp-sheet.tsx:32), which changes access through `src/state/access.ts` (src/features/access/people.tsx:9-18, :149). Side Effects and the "uses only `src/state/whatsapp.ts`" Invariant leave this out.

## src/lib/README.md

- README:29 says "Wide layouts (900px and up) always use `pane`". Any move into `/welcome*` gets no animation from any screen (`b === 'welcome'` returns `null`, src/lib/transitions.ts:157), and any move out of `/welcome*` uses `handoff` even when wide (src/lib/transitions.ts:158); both run before the `wide()` check (src/lib/transitions.ts:160).
- README:29 says "Reduced motion uses `fade`". `wide()` is checked first, so wide layouts with reduced motion still get `pane` (src/lib/transitions.ts:160-161).
- README:28 says navigating to the previous page calls `history.back()`. It only does so when `replace` is false and `to` has no `?` or `#` (`path === to`, src/lib/transitions.ts:91); otherwise it pushes a new entry.
- README:34 says `desktop.ts` exports are "undefined or no-ops in a browser". `focusWindow()` calls `window.focus()` in a browser (src/lib/desktop.ts:53-55).

## src/screens/README.md

- README:33-35 say side effects are indirect except `settings.tsx` and `chat.tsx`. `connection-banner.tsx` also queries directly: `useQuery({ queryKey: connectionKey, queryFn: connectionApi.get, staleTime: 60_000 })` (src/screens/connection-banner.tsx:85-90) and `useHermesList()` (:98).
- README:27 says `connect`, `agent` and `done` are allowed on a fresh Hermes or one that needs setup. Only `connect` accepts `needs-setup`; `agent` and `done` require `fresh` (src/screens/onboarding.tsx:53).
- README:27 says "Any other case redirects to `/`". A returning visitor on `welcome` with `needs-setup` goes to `/welcome/connect` (src/screens/onboarding.tsx:64); a ready Hermes goes through `afterReady()` to `/welcome/agent` or `/welcome/here` (:45, :63).

## src/ui/README.md

- README:31 says "Animations use transform and opacity only". `Grow` animates `height` (src/ui/grow.tsx:43); `Toggle` transitions `width` (src/ui/toggle.tsx:30).
- README:41 says "no network, storage or global state". `sheet.tsx` keeps module-level shared state: sheet stack, scrim map and listener set (src/ui/sheet.tsx:333-336) read through `useSyncExternalStore` (:339), and the module-level `press` record (:384).
- README:38 omits that `SheetPin` writes an inline `--sheet-hold` custom property on the sheet body and removes it on unmount (src/ui/sheet.tsx:283, 291-295).
- README:24 says `TitlebarStrip` and `WindowControlsGap` "render nothing" in a browser. Both always render DOM elements (`div.titlebar-strip`, `span[data-window-gap]`, src/ui/titlebar.tsx:8, 21-30); only CSS hides them.

## server/README.md

- README:62/64 say only the requireHeader check is skipped for the OAuth return. It also skips the sign-in check: `proxyOAuthReturn` runs before `isSignedIn` (server/app.ts:246 vs 248). Intended per server/oauth-return.ts:7, but undocumented.
- README:63 says `originAllowed` is checked "on every mutating request". Requests outside `/hermes/*` and `/murmur/*` are served as static files before the origin check (server/app.ts:242 vs 244).
- README:65 says WebSocket upgrades "get the same checks". Order differs: the `/hermes/api/` path check runs before requireHeader and host checks, and no upgrade check waits on `setupSettled()` (server/app.ts:267-270).
- README:68 says a pinned tab "never falls back to another Hermes". On the single-Hermes `/murmur/connection*` API, `targetFor(req)` is called without the URL, so `?hermes=` is ignored and the cookie or first Hermes is used (server/connection.ts:323, 97-99); `requestTarget` ignores the param too (server/connection.ts:109).
- README:70 says files live "in a `0700` directory". `mkdirSync(..., { mode: 0o700 })` only applies on creation; an existing `DATA_DIR` keeps its permissions (server/config.ts:147, server/telegram.ts:131).
- README:79 lists outbound Hermes calls as "proxying, `/api/status`, `/api/health`, sign-in and token refresh". The server also makes its own calls, including writes:
  - Writes: `PUT /api/config` (server/discovery.ts:425), `POST /api/gateway/restart` (server/telegram.ts:294), `POST /api/messaging/telegram/onboarding/start` (server/telegram.ts:352).
  - Reads: `/api/messaging/platforms` (server/telegram.ts:322), `/api/profiles` (server/discovery.ts:180, 416), `/api/profiles/sessions` (server/discovery.ts:173), `/api/sessions?limit=1` (server/hermes.ts:264), `/api/auth/providers` (server/hermes.ts:150), `/api/auth/ws-ticket` (server/hermes.ts:220).
  - A server-side WebSocket to `/api/ws` (`peek`, server/hermes.ts:355).
  - An uncredentialed relay of the OAuth return to Hermes (server/proxy.ts:180).
- Coverage: undocumented values: `server.headersTimeout = 60_000` and `keepAliveTimeout = 65_000` (server/app.ts:280-281); the 1500 ms local-model probe timeout (server/app.ts:31); data-dir default `./data` (server/config.ts:46); `MURMUR_BUILTIN_HERMES_USERNAME` default `murmur` (server/config.ts:166).

## desktop/README.md

- README:40 says the `x-murmur-desktop` header is added only for the app's own main frame and same-origin frames. `ownPage` returns `true` when there is no frame (`!frame`), so frameless requests such as service-worker requests also get it (desktop/main.ts:257-260, 267).
- README:42 says permissions are limited to "microphone-only media". Only the request handler enforces audio-only (desktop/main.ts:250); the permission check handler allows `media` of any type for the app's own origin (desktop/main.ts:253).
- README:41 only covers `/hermes/api/*` window-opens. Same-origin window-opens outside `/hermes/` and `/murmur/` load in place (desktop/main.ts:220); same-origin window-opens to other `/hermes/*` or `/murmur/*` paths are silently dropped (desktop/main.ts:219-221, 229).
- Coverage: in smoke mode on macOS the app adds `use-mock-keychain` (desktop/main.ts:50), and smoke fails after 60 s (desktop/main.ts:332); neither is documented.

## desktop/scripts/README.md

- README:9 doesn't separate `--dev`. A dev assemble has only `main.js`, `preload.js`, `package.json` and `icon.png`: no `web/`, no licenses (desktop/scripts/build.ts:62). Dev builds use inline source maps and are not minified (desktop/scripts/build.ts:35-36).
- README:9/30 name license files loosely. Root `LICENSE` is copied to `desktop/app/LICENSE`; `src/hermes/vendor/LICENSE` becomes `desktop/app/licenses/hermes-agent.LICENSE` (desktop/scripts/build.ts:66-68).
- README:22 says a full `assemble` without `dist/index.html` throws. The check runs after `desktop/app/` is deleted and partly rebuilt (desktop/scripts/build.ts:57-63), so a failed build leaves that folder wiped and partial.
- README:13 says Electron restarts "whenever `desktop/` or `server/` changes". Restart is driven by esbuild watch, so only files in the import graph of `main.ts` and `preload.ts` trigger it (desktop/scripts/dev.ts:67-87); `scripts/` or `resources/` changes do not.

## scripts/README.md

No drift detected.

## docs/README.md

No drift detected.

## docs/hermes/README.md

- It says every claim is tagged `[LIVE]`, `[SRC]` or `[UNVERIFIED]` (docs/hermes/README.md:8-9). Only agents-and-rooms.md uses that set: chat-protocol.md uses `[live]`/`[source]` (docs/hermes/chat-protocol.md:8-10), models-and-onboarding.md uses `[LIVE]`/`[CODE]` (docs/hermes/models-and-onboarding.md:5-6), and apps-messaging-insights.md has no tags and no backing probe script (docs/hermes/apps-messaging-insights.md:3-5).
- It says the scripts "must only touch `murmur-test-*` profiles" (docs/hermes/README.md:20). Many probes run in the `default` profile (docs/hermes/scripts/03-turn.mjs:8, 06-reconnect.mjs:5, 09-model-effort.mjs:8, 13-errors.mjs:6); `04-approval` falls back to default when `PROFILE` is unset (04-approval.mjs:20-21).
- "Run by hand" (docs/hermes/README.md:20) leaves out that `ar-lib.mjs` is imported by the store screenshot pipeline (umbrel/gallery/tools/seed.mjs:14).

## docs/hermes/scripts/README.md

- "Every socket waits for `gateway.ready`" (README.md:49): `models-lib.mjs` `gw()` returns on socket open (docs/hermes/scripts/models-lib.mjs:31, 37); `ar-lib.mjs` swallows the wait's timeout (docs/hermes/scripts/ar-lib.mjs:67).
- "Helpers answer unhandled server requests with `-32601`" (README.md:49): `models-lib.mjs` never answers them (docs/hermes/scripts/models-lib.mjs:27-28).
- Profile guard list incomplete (README.md:50): `models-reasoning-flow` has the same guard (docs/hermes/scripts/models-reasoning-flow.mjs:8); `models-profile-setup` has none (models-profile-setup.mjs:3, 5).
- "Probes must only touch `murmur-test-*` profiles" (README.md:50) is violated: numbered probes 01, 03, 06, 07, 08, 09, 11, 12, 13, 14 run in `default` (e.g. 07-busy.mjs:5, 11-attachments.mjs:29, 14-two-sockets.mjs:5); `ar-04-quick-turn` runs in `default` without an argument (ar-04-quick-turn.mjs:4, 6); `ar-03` sends `DELETE /api/profiles/default` and POSTs non-test names (ar-03-rest-profile.mjs:11-12, 18); `ar-06` tries to add `default` to a room (ar-06-room-routing-stop.mjs:13).
- Default profiles (README.md:50): only `10-parallel` and `15-approval-reconnect` use `murmur-test-a`/`-b` (10-parallel.mjs:6-7, 15-approval-reconnect.mjs:5); `04-approval` defaults to Hermes's default (04-approval.mjs:20).
- Ordering dependencies incomplete (README.md:51): `15-approval-reconnect` needs `approvals.mode: manual`, which `05-profiles-setup` doesn't set (15-approval-reconnect.mjs:3; 05-profiles-setup.mjs:10); `ar-02`, `ar-05`–`ar-10` need `murmur-test-alpha` and `murmur-test-beta`, and `ar-03` deletes beta unless `--keep` (ar-03-rest-profile.mjs:5, 15-18); `models-*` flows assume `murmur-test-models` from `models-profile-setup` (models-profile-setup.mjs:3, 5).
- "`models-oauth-shapes` never starts a real device flow" (README.md:52): it POSTs `/api/providers/oauth/anthropic/start` with a valid token (models-oauth-shapes.mjs:5) and DELETEs the real `claude-code` provider (:9), relying on Hermes refusing them.
- Approval commands (README.md:58): only 04 uses `/tmp/murmur-approval-test` (04-approval.mjs:25); 15 runs `rm -rf /tmp/murmur-reconnect-test` (15-approval-reconnect.mjs:11); ar-08 runs `rm -rf /tmp/murmur-approval-probe-dir-3` (ar-08-approval-status.mjs:7).
- `15-approval-reconnect` always answers `once`, so its command does run in the Hermes container (15-approval-reconnect.mjs:21); the contract implies only 04 can do this.
- "Usage and env vars are in each file's header comment" (README.md:39) is false for `03-turn` (`TITLE`, `EFFORT`; 03-turn.mjs:3, 8), `12-clarify` (`PROMPT`; 12-clarify.mjs:14), `models-custom-endpoint-flow` (`FAKE_KEY`; :8), and `04-approval` (`NO_CAPS` inline only; 04-approval.mjs:19).

## umbrel/README.md

- Subdirectories section (umbrel/README.md:66) says the `hermes` image is what "the contract suite" uses. The nightly workflow runs against `nousresearch/hermes-agent:latest` via `HERMES_IMAGE` (.github/workflows/hermes-nightly.yml:13, 22); only `ci.yml` uses the pinned image (test/contract/harness.ts:18-19).
- Same line names only `dev/docker-compose.yml` as sharing the image; the root `docker-compose.yml` pins it too (docker-compose.yml:33).

## umbrel/gallery/README.md

No drift detected.

## umbrel/gallery/tools/README.md

- `model.mjs` (README.md:15) matches the last user message, not the opening one, for replies and `TITLES` (umbrel/gallery/tools/model.mjs:136, 141, 153).
- Invariants (README.md:22): "check with you first" and "41 GB free again" are `model.mjs`'s scripted replies, not app strings (model.mjs:109, 112). The app strings `capture.mjs` depends on are `Allow` (src/features/chat/approval-card.tsx:117), `Searched files` (src/features/chat/tool-labels.ts:268) and the `Message <agent>` placeholder (src/screens/chat.tsx:536).
- "`seed.mjs` sets approvals to `manual`" (README.md:23): it only appends a `manual` block when `config.yaml` has no `approvals:` key (umbrel/gallery/tools/seed.mjs:48-50).

## umbrel/murmur/README.md

- "Gated by the derived username/password" (README.md:27): only the password and session secret are derived (umbrel/murmur/exports.sh:3-4); the username is hard-coded `murmur` (umbrel/murmur/docker-compose.yml:22, 44).
- `hermes` service Interface (README.md:17) omits `HERMES_UID`, `HERMES_GID`, `HERMES_DASHBOARD: "1"` and `stop_grace_period: 1m` (umbrel/murmur/docker-compose.yml:37, 41-43).
- Invariants (README.md:25) require only `dev/docker-compose.yml` to share the Hermes image; the root `docker-compose.yml` pins it too (docker-compose.yml:33; dev/docker-compose.yml:10, 34).
- Verification (README.md:40) says `npm run test:contract` runs against "the `hermes` image pinned here"; the nightly workflow uses `nousresearch/hermes-agent:latest` (.github/workflows/hermes-nightly.yml:22).

