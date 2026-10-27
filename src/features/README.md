# features

## Overview

Murmur's product features. Each subdirectory holds the React components, hooks and pure helpers for one user-facing area, such as chat, the home roster, onboarding, settings, routines, or a messaging platform. Features render data from `src/state` (zustand and react-query) and use shared UI from `src/ui`. Most Hermes traffic goes through `src/state`. Some features call `src/hermes` directly: `api` from `src/hermes/rest.ts`, and `gateway` or `rpc` from `src/hermes/gateway.ts`. This directory has no source files of its own.

## Subdirectories & Boundaries

- access: [./access/README.md](./access/README.md) - Requests from people on messaging platforms to talk to an agent, and the people already allowed (`RequestCard`, `People`, `PlatformGlyph`).
- agent-page: [./agent-page/README.md](./agent-page/README.md) - An agent's page and the All agents gallery: hero, quick-action tiles, chat list (pin, archive, rename), weekly summary, and the default-model sheet. Reads `/api/sessions`.
- agents: [./agents/README.md](./agents/README.md) - Create, edit, import and export agents (`AgentEditor`, `useImportAgent`), and pick agents for a new group.
- apps: [./apps/README.md](./apps/README.md) - Connect an agent to MCP catalog apps and Umbrel apps (`AppsSheet`), with app icons drawn locally from `marks.ts`.
- chat: [./chat/README.md](./chat/README.md) - The conversation: `Thread`, `Composer`, approval, clarify and secret cards, plan, helpers, tapbacks, @mentions, lazy markdown with a reduced Shiki, and plain-language errors, notices and tool labels. Drafts are kept in `localStorage`.
- chat-screen: [./chat-screen/README.md](./chat-screen/README.md) - The parts around a chat: header, chat menu (copy, share, pin, rename, archive, delete), context and cost sheet, goal chip, file drop target, and empty and not-found states.
- commands: [./commands/README.md](./commands/README.md) - Slash commands (unlisted ones pass through to Hermes), the command palette, and keyboard shortcuts.
- connection: [./connection/README.md](./connection/README.md) - Murmur sign-in (`AccessGate`), `HermesGate`, the "Connect to Hermes" form, finding nearby Hermes instances, the multi-Hermes switcher, and the outdated-Hermes screen.
- group: [./group/README.md](./group/README.md) - Group chat UI: a composer with an @mention picker, header, members sheet, and the members' Buddies. Converts between names and handles.
- home: [./home/README.md](./home/README.md) - The roster of agents and groups, solo home, chats nested in the sidebar, row and "+" menus, suggestions, and the install tip.
- media: [./media/README.md](./media/README.md) - Files and widgets agents deliver (`MEDIA:`, `::preview`), loaded through `/hermes/api/fs/*`. Includes the lightbox and the sandboxed `PreviewFrame`.
- memory: [./memory/README.md](./memory/README.md) - An agent's memory row and sheet.
- model: [./model/README.md](./model/README.md) - Model and thinking-level choice (`/api/model/*`, `config.get` and `config.set` for `reasoning`), readable model names, and plan usage gauges.
- notifications: [./notifications/README.md](./notifications/README.md) - System notifications for finished chats, agents that need you, and routine results.
- onboarding: [./onboarding/README.md](./onboarding/README.md) - The first-run flow: Welcome animation, choosing where agents live, Getting ready, Connect a model, the first agent, and the closing screens.
- routines: [./routines/README.md](./routines/README.md) - Scheduled routines: schedules described in times and days, blueprint templates, run views, and the rule for quiet runs.
- search: [./search/README.md](./search/README.md) - The chat search field and results list.
- settings: [./settings/README.md](./settings/README.md) - Settings pages and navigation stack, theme, Hermes servers, models and local services, pictures, the Umbrel MCP connection, and the `ask()` prompt.
- telegram: [./telegram/README.md](./telegram/README.md) - Telegram bot pairing (QR code), status, and turning it off.
- templates: [./templates/README.md](./templates/README.md) - Ready-made agent templates, the template grid, and `NewAgentSheet`.
- vault: [./vault/README.md](./vault/README.md) - An agent's encrypted logins, cards and addresses (`VaultSheet`). Site icons are never fetched.
- voice: [./voice/README.md](./voice/README.md) - Dictation through `/api/audio/transcribe` and read-aloud through `/api/audio/speak`.
- whatsapp: [./whatsapp/README.md](./whatsapp/README.md) - Linking WhatsApp, its status, and turning it off.

## Verification

- Run: `npm test`
