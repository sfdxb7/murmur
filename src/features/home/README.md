# home

## Overview

The home screen and sidebar. This covers the roster of agents and groups, the single-agent home, chats nested under an agent's row, the "+" menu and row context menus, gentle suggestions, the install tip, and agent actions taken from the roster.

## Interface

- `roster.tsx`: `Roster` (with `Density` set to roomy or compact), `NeedsYou` and `noteArrivals`.
- `solo.tsx`: `useSoloAgent` and `SoloChats`. When there is exactly one agent and no groups, home shows that agent's chats directly.
- `nested-chats.tsx`: `NestedChats` and `useShowsChat`, an agent's pinned and latest chats under its row in the sidebar.
- `expanded.ts`: `useExpanded` and `setExpanded`, which control which agents show their chats in the sidebar.
- `groups.ts`: `useGroupRows`, `useCanMakeGroups`, `createGroup` and the type `GroupRow`, which turn groups into roster rows.
- `actions.tsx`: `useAgentActions`, which returns roster actions plus `sheets`. Render `sheets` once.
- `row-menu.tsx`: `RowMenu`, `useLongPress` and the types `MenuItem` and `MenuPlace`. Open the menu with touch and hold, right-click, or "…". Place it inside a `Popover.Root` and `Popover.Anchor`.
- `new-menu.tsx`: `NewMenu`, `menuItem` and `menuKeys`.
- `suggestion.tsx`: `Suggestion`, a single next step: a second agent, then a group.
- `install-tip.tsx`: `useInstallTip` and `InstallTip`.
- `agent-href.ts`: `agentHref`, where an agent's row goes.
- `time.ts`: `shortTime` ("now", "4m", "Yesterday", "12 Oct") and `greeting`.
- `bone.tsx`: re-exports `Skeleton` from `src/ui/skeleton` as `Bone`.

## Invariants

- The roster has one row per agent and one per group, newest activity first.
- An agent row opens the agent's newest chat. A chat waiting on your answer comes first, and an agent with no chats opens its main chat. The whole row is one link.
- The roster appears only when there is a second agent or a group. Before that, the solo layout is shown.
- The agent you are in opens in the sidebar on its own. Choices you make in the sidebar are remembered.
- Each `Suggestion` and the install tip, once dismissed, stay dismissed (`murmur:tip-dismissed:*`). The install tip shows only on a phone, only after the first chat that got a reply, and never once the app is installed.
- `RowMenu` is the context menu for roster rows and for every chat list.

## Side Effects

- `localStorage` keys `murmur:sidebar-open` (`expanded.ts`) and `murmur:tip-dismissed:*` (`suggestion.tsx`, `install-tip.tsx`). These keys are shared by every Hermes.
- `install-tip.tsx` listens for `beforeinstallprompt` and can show the browser's install prompt.
- `actions.tsx` and `groups.ts` call `src/state/agents.ts` (`createAgent`, `updateAgent`, `deleteAgent`, `revealAgent`) and `src/state/groups.ts` (`createGroup`, `renameGroup`, `deleteGroup`). These change data on Hermes.
- `row-menu.tsx` and `actions.tsx` call `navigator.vibrate`.

## Verification

- Run: `npm test`
