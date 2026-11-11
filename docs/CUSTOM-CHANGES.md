# Saeed’s custom Murmur changes (hidden agents + chat speed)

Preserved on 2026-11-11 so they can be re-applied later. They were **not** merged into the live install: murmur-app was upgraded to official Murmur v0.13.0 instead, because merging this work onto v0.13.0 hit non-trivial conflicts (see below).

## Where this lives

- Repo: https://github.com/sfdxb7/murmur
- Branch: `hidden-agents-and-chat-speed` — https://github.com/sfdxb7/murmur/tree/hidden-agents-and-chat-speed
- Durable tag (points at the feature tip, before this notes commit): `custom-hidden-agents-chat-speed-v0.11.1`
  - Commit: `cd0b7225d0f1d4dae7dc8615b7c1b8fd20cfc49f`
  - https://github.com/sfdxb7/murmur/releases/tag/custom-hidden-agents-chat-speed-v0.11.1
  - https://github.com/sfdxb7/murmur/tree/custom-hidden-agents-chat-speed-v0.11.1
- Based on `1411b5c` (“Pin Murmur 0.11.1 in the umbrelOS package”), which sits just after upstream tag `v0.11.1` (`0e19f04`).
- The live image `murmur:sfdxb7-2b343e8` (built 2026-11-05 19:21 Asia/Dubai from `/opt/murmur/src/build-speed`) matches `cd0b722` exactly (the short SHA `2b343e8` is not in this repo; it was almost certainly a rewritten local commit with the same tree).

Do not force-push or delete this branch or tag. Do not treat this as the live deploy branch after 2026-11-11.

## The two features, in plain words

1. **Hidden agents.** You can hide or unhide an agent from its menu. Hidden agents stay off Murmur’s lists, but they remain real agents: their “needs you” items still count, and Unhide / Show hidden stay easy to find. The hidden flag is **not** stored in Murmur’s data volume. It is written to Hermes as `ui_meta['hermes-bots'].hidden`. Official Murmur does not read that flag, so after the v0.13.0 upgrade those agents will show in the list again; the Hermes metadata is left in place for a later re-apply.

2. **Chat speed.** Opening a chat loads the newest 150 rows first, not 500. If one long turn fills that first page (no user row on it), Murmur loads the full history so undo/edit can still find the message that started the turn. The chat list is shown from the last visit while it refreshes, is also stored from the agent page, must not outlive changes/errors/other readers, and chats are allowed to paint ahead of side panels and routine history.

## The 13 custom commits (oldest first)

All on `1411b5c..cd0b722`:

| SHA | Description |
| --- | --- |
| `6ce3e3b` | Hide agents marked hidden from Murmur’s lists |
| `944eda1` | Keep hidden agents’ needs-you items; test solo selection |
| `e08d254` | Hide and unhide agents from their menu |
| `47a2b66` | Look up the main chat by title only when the listing lacks it |
| `43b594b` | Pin how an agent’s chats are listed; revert the title-lookup shortcut |
| `267e2c2` | Show an agent’s chats from the last visit while they refresh |
| `957232e` | Keep the stored chat list from outliving changes, errors, or other readers |
| `30663c9` | Hidden profiles: keep Unhide reachable, quiet hidden agents’ counts, calm the chat list |
| `c4c68d1` | Hidden agents: make Show hidden and Unhide easy to find |
| `bfa778a` | Let chats go ahead of side panels and routine history |
| `6b5b807` | Store the chat list from the agent’s page too |
| `c0abe3b` | Open a chat on its newest 150 rows instead of 500 |
| `cd0b722` | Read the full page when one long turn fills the first |

## Files touched

25 files, **+811 / −51** versus `1411b5c`:

```
src/app.tsx
src/features/agent-page/chats.ts
src/features/agent-page/stand-in.test.ts   (new)
src/features/agent-page/stand-in.ts        (new)
src/features/chat-screen/elsewhere.tsx
src/features/home/actions.tsx
src/features/home/groups.ts
src/features/home/hide.ts                  (new)
src/features/home/roster.tsx
src/features/home/solo.tsx
src/features/home/suggestion.tsx
src/hermes/rest.ts
src/hermes/turns.test.ts                   (new)
src/hermes/turns.ts                        (new)
src/screens/agents.tsx
src/screens/home.tsx
src/screens/onboarding.tsx
src/state/agents.test.ts
src/state/agents.ts
src/state/chats.test.ts
src/state/chats.ts
src/state/connection.ts
src/state/routines.ts
src/state/sections.test.ts
src/state/sections.ts
```

`hide.ts`, `stand-in.ts`, and `turns.ts` do **not** exist in upstream v0.13.0. Merge-base with v0.13.0 is `1411b5c`; none of the 13 commits are in the 0.13.0 ancestry.

## Conflicts with upstream v0.13.0, and how to resolve them later

A test merge of `origin/hidden-agents-and-chat-speed` onto `v0.13.0` was left uncommitted at `/opt/murmur/src/merge-v0130` on the VPS (local branch `sfdxb7-v0.13.0`). 12 files overlapped; 9 auto-merged. Three files conflicted. Do not push that branch. To start over: in that worktree, `git merge --abort` (do not delete the branch). Re-do the merge onto whatever Murmur tag is current at the time.

### 1. `src/features/home/groups.ts` (1 hunk)

- **Upstream** (`1c9fcd5` “A group has more than one chat”) added `GroupChatRow` and imports `useAgents`, `useMemo`, and `foldGroups`.
- **Custom** (`6ce3e3b`) switches the roster to `useVisibleAgents` so hidden agents stay off group lists.
- **Resolve later:** keep upstream’s multi-chat group types and `foldGroups` / `useMemo`, but import and use `useVisibleAgents` instead of `useAgents`.

### 2. `src/state/agents.test.ts` (1 hunk)

- Conflict is the import list. Custom adds `setAgentHidden`, `visibleAgents`, `keepChats`, `keptChats`, `dropKeptChat`, `fetchAgentChats`, `toAgent`, `soloOf`, and related exports. Upstream (`f8e2aed` “Deleting an agent closes its open chats in Hermes first”) also touched this file.
- **Resolve later:** union the imports (keep both sets). Then review the rest of the auto-merged tests, especially delete-agent-closes-chats versus hidden-agent and kept-chat tests.

### 3. `src/state/chats.ts` (2 hunks — not trivial)

- **Custom** (`c0abe3b`, `cd0b722`): `FIRST_PAGE = 150`; `readHistory` asks for that first page, and if the page has no user row it loads the full history. `older` is `rows.length >= FIRST_PAGE`.
- **Upstream** (`a6cdd67` “A chat that can’t be opened says so, and keeps trying”, plus later find-in-chat / `told` / photo / routine-in-chat work): 404 handling uses an `absent` set, retry/stalled behavior, `older: rows.length >= PAGE`, and a `told` field.
- **Resolve later:** combine both. Keep `FIRST_PAGE = 150` and the “no user row on the first page → load full history” fallback, **and** keep upstream’s 404/`absent`/retry/stalled path and the `told` field. Set `older` from `FIRST_PAGE`, not `PAGE`. Do not take one side wholesale — that would drop either the speed path or the “can’t be opened” behavior. Also re-check the auto-merged neighbors (`agents.ts`, `roster.tsx`, `home.tsx`, and the rest of `chats.ts`).

## Re-applying later (outline)

1. In a fresh worktree of sfdxb7/murmur, start from the official tag you want (e.g. a later v0.14.x, or v0.13.0 again).
2. `git merge custom-hidden-agents-chat-speed-v0.11.1` (or rebase the 13 commits). Resolve the three conflicts as above; review auto-merged files.
3. Build a new image, e.g. `murmur:sfdxb7-<newsha>-v0xxx`, and deploy only murmur-app (`/opt/murmur/compose.yml`, project `murmur-vps`). Do not push unless asked. Do not touch Abdulla Murmur or Hermes unless asked.
4. Hidden flags already stored on Hermes should start being honored again once the hide UI and `useVisibleAgents` are back.

A copy of this file is also at `/workspace/vps-oracle/murmur-custom-changes.md`.
