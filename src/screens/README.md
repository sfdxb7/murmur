# screens

## Overview

These are the top-level routed pages of the Murmur app. Each screen is a thin composition layer. It reads route params, pulls data from `@/state/*` hooks, and arranges components from `@/features/*` and `@/ui/*`. Routing is wired in `src/app.tsx` with wouter, using `useTransitionLocation` from `@/lib/transitions`. `HomeScreen`, `Sidebar`, `ChatScreen` and `ConnectionBanner` are imported eagerly. The other screens are code-split with `lazyComponent`.

## Interface

| Export | File | Route / use |
| --- | --- | --- |
| `HomeScreen()` | `home.tsx` | `/`: the agent roster, search and greeting (the phone layout). |
| `Sidebar()` | `home.tsx` | Sidebar for wide layouts (900px and up), shown beside every pane. |
| `ChatScreen({ agentId, chatId? })` | `chat.tsx` | `/chat/:agent/:chat?`. `/chat/:agent` opens the latest chat, `/chat/:agent/new` is a blank chat that Hermes creates on the first message, and `/chat/:agent/:id` is a stored chat. |
| `AgentScreen({ agentId })` | `agent.tsx` | `/agent/:agent`: the agent's page (hero, quick actions, chats, and sheets for model, routines, memory, apps, vault, Telegram and WhatsApp). |
| `ChatsScreen({ agentId })` | `chats.tsx` | `/chats/:agent`: one agent's chat list (phones). |
| `AgentsScreen()` | `agents.tsx` | `/agents`: gallery of all agents. |
| `GroupScreen({ groupId })` | `group.tsx` | `/group/:group`: multi-agent group chat. |
| `SettingsScreen({ section? })` | `settings.tsx` | `/settings/:section?`. Sections are `models`, `agents`, `hermes` (titled "Server"), `umbrel` and `about`. |
| `OnboardingScreen({ step? })` | `onboarding.tsx` | `/welcome/:step?`. Steps are `welcome`, `connect`, `agent`, `done` and `here`. |
| `ConnectionBanner({ inset?, hold? })`, `Island({ phase, inset? })` | `connection-banner.tsx` | The reconnecting/lost "island" overlay. `Island` is exported for the UI lab. |

## Invariants

- Screens hold no domain logic. Data and mutations come from `@/state/*`, such as `useAgents`, `useChats`, `send`, `createChat`, `useGroup` and `sendToGroup`, and from feature hooks. New behaviour belongs in `state/` or `features/`, not here.
- Screens navigate with wouter's `useLocation`, which is backed by `@/lib/transitions`, and compute back targets with `useUpFrom`. They do not touch `history` directly.
- All screens except onboarding and the connection banner switch layout on `useIsWide()`. Wide layouts render inside the pane beside `Sidebar`. On phones, `src/app.tsx` wraps each page in `SwipeBack` and the screen fills the display.
- `OnboardingScreen` only allows the `connect`, `agent` and `done` steps on a fresh Hermes (or one that still needs setup), and `here` only right after choosing a Hermes that already has agents. Any other case redirects to `/` with `replace`, so these steps never overwrite an existing main agent.
- `ConnectionBanner` stays hidden for outages shorter than 1.5 s and while `hold` is set (splash visible). It switches to "lost" after 6 s if the gateway has never connected, or 12 s if it was connected before.
- Unknown `section` or `step` params fall back to a default (the settings index, or `welcome`). They never throw.

## Side Effects

- Indirect only. Screens trigger Hermes RPC and REST traffic through `@/state/*` and feature actions. Direct exceptions:
  - `settings.tsx` queries REST `/api/status` (query key `['hermes-status']`) for the Hermes version.
  - `chat.tsx` invalidates the `['chats', agentId]` React Query cache.
- `chat.tsx` and `home.tsx` add `window` `keydown` listeners for shortcuts. `chat.tsx` and `group.tsx` add scroll listeners to the message log. All are removed on unmount.
- Toasts (`sonner`), timers for banner phases and entrance animations, and module-level "already greeted" flags (`agents.tsx`).

## Verification

- Run: `npm test`
- Run: `npm run typecheck`
