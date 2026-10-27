# docs/hermes

## Overview

Integration notes for the Hermes Agent gateway that Murmur talks to, plus the
live probe scripts that back them. This folder has no runtime code: the notes
are specifications that Murmur's server and client are written against, and
each claim is tagged with how it was established (`[LIVE]` against a running
Hermes, `[SRC]` read from Hermes source at a pinned tag, or `[UNVERIFIED]`).

Protocol notes in this folder:

- [chat-protocol.md](./chat-protocol.md): the `/api/ws` JSON-RPC chat protocol (sessions, turns, streaming events, approvals, reconnect, attachments, errors). Targets Hermes v0.21.5 (tag `v2026.9.24`).
- [agents-and-rooms.md](./agents-and-rooms.md): agents (Hermes profiles), canonical chats, hosted group rooms (`groups.*`) and roster status.
- [models-and-onboarding.md](./models-and-onboarding.md): models, providers (API keys, OAuth, custom endpoints) and onboarding readiness checks.
- [apps-messaging-insights.md](./apps-messaging-insights.md): apps, WhatsApp and messaging access, usage, moving agents and passwords. Targets Hermes 0.22.

## Subdirectories & Boundaries

- scripts: [./scripts/README.md](./scripts/README.md) - Dependency-free Node 22+ probes against a live Hermes (`01-15` chat protocol via `lib.mjs`, `ar-*` agents and rooms via `ar-lib.mjs`, `models-*` via `models-lib.mjs`). They mutate the target Hermes and must only touch `murmur-test-*` profiles. Run by hand; not covered by `npm test`.
