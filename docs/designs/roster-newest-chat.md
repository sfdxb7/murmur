# Open an Agent's Newest Chat from the Roster

*   **Author:** sfdxb7
*   **Status:** Proposed
*   **Date:** 2026-10-27

--------------------------------------------------------------------------------

## Overview

The roster is the list of agents on Home: the main screen on a phone and the
sidebar on a wide screen. Each agent row shows the agent's name, its orb, and
one line under the name. When the agent is idle and its chats are folded away,
that line is the title of the agent's newest chat.

This design makes a tap on an agent row open the chat that line names: the
agent's newest chat. Only a chat that is waiting on your answer comes before it.
The agent's full chat list stays one step further in, through the chat's header.

It replaces the change in
[sfdxb7/murmur#1](https://github.com/sfdxb7/murmur/pull/1), which opened the
newest chat only while it was unread and kept the old destinations otherwise.

## The Problem

On a phone, an agent with more than one chat opens its chat list
(`/chats/<agent>`) when you tap its row. This happens even when the row's line
is showing a fresh update from one of those chats. To read the update you tap
the row, find the same chat at the top of the list, and tap it again. The line
told you exactly which chat changed, and the app still asks you to pick it.

In the desktop sidebar the row has a different rule: it opens the agent's main
chat. If the newest chat is another one, the click lands in a chat the row did
not name.

The row's line and the row's destination disagree. The line names one chat,
and the tap goes somewhere else.

PR #1 fixed this only while the newest chat was unread. Once read, the same tap
went back to the chat list, so one row led to two different places depending on
state you cannot see once the dot is gone.

Before PR #1, the row picked its destination like this (first match wins):

1.  The agent is waiting on you (an approval or a question): open that chat.
2.  On a phone, the agent has more than one chat (counting a routine result):
    open the chat list.
3.  The newest chat is a routine result: open it.
4.  Otherwise: open the agent's main chat.

## Goals

*   **The row opens the chat its line names.** Tapping an agent row opens the
    agent's newest chat, whether it is read or not, on a phone and in the
    desktop sidebar. New messages land in the newest chat, so an update is
    always one tap away.
*   **A waiting agent still comes first.** A chat that needs your answer opens
    ahead of the newest chat, as it does today.
*   **The chat list stays reachable.** From the opened chat, the header opens
    the agent page, which lists the agent's chats. Browsing an agent's chats
    goes from one tap to two on a phone; that cost is accepted.
*   **The desktop sidebar changes too, and says so.** The sidebar row used to
    open the main chat. It now opens the newest chat, which is the same chat
    whenever the main chat is the newest.
*   **No new tap targets.** The whole row stays one link (see Alternative D).

## Non-Goals

*   **Group rows.** Groups have one conversation each and already open it
    directly.
*   **Unread tracking.** Where the row goes no longer depends on unread state.
    The unread dot and the "new messages" screen-reader label stay as they are,
    and so does the rule behind them in `src/state/status.ts`.
*   **The chat list and agent page screens** (`/chats/<agent>`,
    `/agent/<agent>`): their layout and ordering stay as they are.
*   **Notifications.** Tapping a notification already opens its chat; this
    design does not touch that path.

## Open Questions

None. Two questions raised while drafting were settled from the code:

*   **A row with no chats** has no newest chat, so it opens `/chat/<agent>`,
    the main chat, as it does today.
*   **The `/chats/<agent>` route** keeps its screen. After this change only the
    back-navigation rules in `src/lib/transitions.ts` mention it; see Future
    Improvements.

--------------------------------------------------------------------------------

## Technical Plan (Architecture)

### Where the decision is made

Everything happens in one place: `AgentRow` in `src/features/home/roster.tsx`.
The row computes a single `href` and hands it to `RowLink`, which renders the
whole row as one `wouter` `Link`. No route, store, or server code changes.

The row needs two inputs, both already present:

| Input | Source | What it says |
| :---- | :----- | :----------- |
| `status.state`, `status.chatId` | `useAgentStatus` (`src/state/status.ts`) | Whether the agent is waiting on you, and in which chat |
| `agent.lastChat` | `newestChat` (`src/state/agents.ts`) | The newest chat: `id`, `title`, `at`, and flags `main` and `routine`. It includes the hidden main chat when that moved most recently, and a routine run when that is newest. |

```text
 Agent row tapped
        │
        ▼
 waiting on you? ──yes──► /chat/<agent>/<waiting chat>
        │ no
        ▼
 has a newest chat? ──yes──► /chat/<agent>/<newest chat>
        │ no
        ▼
 /chat/<agent>  (main chat)
```

Three branches replace five. The routine-result branch folds into "newest
chat", because a routine run that is newest is already `agent.lastChat`.

### What the row stops doing

*   **Counting chats on a phone.** The row calls `useAgentChats(agent.id)` on
    the phone layout only to decide between the list and a single chat. With
    B, that count is unused, so the call goes. `fetchAgentChats` makes three
    `session.list` calls, so this removes three Hermes requests per agent when
    Home loads on a phone. The side effect: the
    `['chats', <agent>]` cache is no longer filled from Home, so the agent page
    loads its list when opened instead of finding it ready.
*   **Using unread state to route.** PR #1's `unread` branch goes. `unread`
    itself stays, because the row still uses it for the dot and the label.

### Why the URL works for every kind of newest chat

`/chat/:agent/:chat?` takes any session id. The agent page's chat list already
links `/chat/<agent>/<chat.id>` for every row, main chat included, and routine
runs already open this way. So `lastChat.id` needs no special case.

### What happens after the tap

The chat opens and `setViewingChat` marks it seen, which clears the dot. The
next tap on the row opens the same chat again, unless a newer chat has appeared
in the meantime. From inside the chat, the header opens the agent page
(`/agent/<agent>`) with the agent's chats, and Back returns to Home.

## Alternatives Considered

### Alternative A: Open the newest chat only while it is unread (PR #1 as built)

When the newest chat is unread, the row opens it; otherwise the row keeps its
old destinations (chat list on a phone with several chats, main chat in the
sidebar).

*   **Pros**: Already built, in PR #1. Leaves browsing an
    agent's chats at one tap. Changes nothing for anyone who never has unread
    chats.
*   **Cons**: The same tap goes to two different places, and which one depends
    on a dot that disappears once you read the chat. Keeps the sidebar opening
    the main chat even when another chat is newest. Adds a branch to the
    routing rules instead of removing ones.
*   **Reason for Rejection**: The owner chose B. A fixes the symptom (an extra
    tap for an update) while keeping the cause: the row's line and its
    destination can still disagree.

### Alternative C1: A, plus an unread count with unread tracked for every chat

Home fetches each agent's recent chats with their last-activity times (the REST
call `/api/sessions?order=recent` that the agent page already makes) and counts
unread chats. With two or more unread, the row opens the chat list and shows
the count.

*   **Pros**: Catches updates in older chats, which nothing in the app tracks
    today.
*   **Cons**: One extra request per agent each time Home loads or chats change.
    Widening "unread" beyond the newest chat would mark every chat that moved
    since you started using Murmur (Telegram threads, for example), all at
    once. Changes the meaning of unread across the app, which is a larger
    design than this one.
*   **Reason for Rejection**: Its benefit depends on per-chat unread data the
    app deliberately does not keep: only the newest chat and routine results
    are tracked (`useUnread` in `src/features/agent-page/chats.ts`). Building
    that is its own project.

### Alternative C2: A, plus a count of what is already tracked

Same as C1, but the count covers only the newest chat and unread routine
results.

*   **Pros**: No new requests.
*   **Cons**: The count can rarely exceed 1, so the row behaves almost exactly
    like A. Adds a second visual to a row that already has a dot.
*   **Reason for Rejection**: Adds UI without a meaningful change in behaviour.

### Alternative D: Make the line under the name a separate tap target

The line opens the newest chat; the rest of the row keeps its old destination.

*   **Pros**: Both destinations stay one tap away.
*   **Cons**: The line is about 20px tall, below the roughly 44px a phone tap
    target needs. Taps meant for the line would often land on the name and open
    the list, so the row would seem to behave at random. Two links in one row
    also complicate keyboard navigation (⌥↑/⌥↓ walk the rows) and screen
    readers.
*   **Reason for Rejection**: Unreliable on a phone, which is where the problem
    is.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Performance:** Home on a phone makes three fewer Hermes requests per
    agent (the three `session.list` calls inside `fetchAgentChats`). The agent page then
    loads its list on open instead of finding it cached.
*   **Rollout and rollback:** Client-only change in one component. Rolling back
    is reverting the commit; no stored data or server behaviour depends on it.
*   **Accessibility:** The row stays a single link with the same label, so
    screen readers and keyboard navigation (⌥↑/⌥↓) are unchanged.

### Future Improvements

*   **The chat list screen at `/chats/<agent>`** is no longer linked from the
    roster. The agent page lists the same chats. Once nothing else needs it,
    the route, `ChatsScreen` and its back-navigation rules in
    `src/lib/transitions.ts` can be removed in a separate change.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

The work replaces PR #1's change on the same branch
(`egm-contracts-roster-unread`), so the PR ends up holding B, not A.

### Target Files to Create/Modify

#### 1. `src/features/home/agent-href.ts` (Create)

*   **Type / Scope**: TypeScript module, pure function.
*   **Proposed Changes**: One exported function that holds the row's routing
    rule, so it can be unit-tested without rendering React:

    ```text
    agentHref(agentId: string, waitingChatId?: string, newestChatId?: string): string
      waitingChatId  → /chat/<agentId>/<waitingChatId>
      newestChatId   → /chat/<agentId>/<newestChatId>
      otherwise      → /chat/<agentId>
    ```

    A one-line comment states the rule's reason: the row opens the chat its
    line names.

#### 2. `src/features/home/agent-href.test.ts` (Create)

*   **Type / Scope**: Vitest unit test, same style as
    `src/features/notifications/compose.test.ts`.
*   **Proposed Changes**: Three cases, one per branch:
    1.  Waiting chat and newest chat both given: the waiting chat wins.
    2.  Only a newest chat: opens it.
    3.  Neither: opens `/chat/<agent>`.

#### 3. `src/features/home/roster.tsx` (Modify)

*   **Type / Scope**: React component (`AgentRow`).
*   **Proposed Changes**:
    *   Replace the `href` expression (PR #1's version, lines ~236–246) with
        `agentHref(agent.id, status.state === 'waiting' ? status.chatId : undefined, agent.lastChat?.id)`.
    *   Delete `conversations` (the phone-only `useAgentChats` call) and
        `routine`, which only fed the old rule.
    *   Delete the comment above them ("On a phone's Home, an agent with
        several chats opens on the list of them…"), which describes the old
        rule, and PR #1's "Something new opens straight into…" comment.
    *   Drop `useAgentChats` from the `@/state/agents` import. Keep
        `fetchAgentChats`, which `warm` still uses for the sidebar.
    *   Keep `active` and `unread`: the row still uses them for the dot and the
        screen-reader label.

#### 4. `src/features/home/README.md` (Modify)

*   **Type / Scope**: EGM contract.
*   **Proposed Changes**:
    *   Interface: add `agent-href.ts`: `agentHref`, the agent row's
        destination.
    *   Invariants: add "An agent row opens the agent's newest chat. A chat
        waiting on your answer comes first; an agent with no chats opens its
        main chat. The whole row is one link."

#### 5. PR #1 on GitHub (Modify, not a file)

*   **Type / Scope**: Pull request title and description.
*   **Proposed Changes**: Retitle to describe B ("Open an agent's newest chat
    from the roster; add EGM contracts") and rewrite the roster part of the
    description: the new rule, the extra tap to browse chats on a phone, the
    sidebar no longer opening the main chat, and the dropped per-agent request.
    Link the final design document.

#### 6. `docs/designs/roster-newest-chat.md` (Create, at finalization)

*   **Type / Scope**: Design document.
*   **Proposed Changes**: The finished contents of `design_draft.md`, saved
    when the draft is finalized. `design_draft.md` itself is a working file
    and is not committed.

### Verification Plan

*   **Compilation/Build**: `npm run typecheck` (`tsc -b`).
*   **Unit Tests**: `npm test`; the three `agentHref` cases must pass with the
    existing 317 tests.
*   **Static Analysis & Linting**: None configured beyond `tsc`.
*   **Manual, on a phone (Android Chrome):**
    1.  An agent with several chats: tapping the row opens its newest chat,
        read or unread.
    2.  An agent waiting on an approval: the row opens that chat.
    3.  An agent with no chats: the row opens the main chat.
    4.  From an opened chat, the header opens the agent page with its chats.
*   **Manual, desktop sidebar:** an agent whose newest chat is not the main
    chat opens that newest chat; expanding the row still lists the nested chats.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
