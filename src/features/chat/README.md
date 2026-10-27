# chat

## Overview

The conversation itself: the message thread, the composer, and the cards and live moments within a turn. This includes approvals, clarifying questions, secret requests, the plan checklist, helpers, tool steps, tapbacks and @mentions. It also covers markdown rendering with lazily loaded Shiki highlighting, and plain-language text for Hermes errors, notices and tool names. The chat store in `src/state` turns Hermes events into the view model in `types.ts`. The components here render that view model.

## Interface

- **View model** (`types.ts`): `ChatItem`, `ChatStatus`, `Speaker`, `ApprovalChoice`, `SecretAsk`, `ClarifyQuestion`, `UserAttachment`, `Reaction` and `Todo`.
- **Thread and composer**:
  - `thread.tsx`: `Thread` and `ErrorNote`.
  - `composer.tsx`: `Composer` and its imperative handle `ComposerHandle`, which lets a screen add files or fill in text. It re-exports `useKeyboardInset`.
  - `use-draft.ts`: `useDraft(key)` (unsent text saved per chat or group) and `useAutoGrow`.
  - `use-keyboard-inset.ts`: `useKeyboardInset`, the on-screen keyboard's height in px.
  - `use-copy.ts`: `copyText(text)` and `useCopy`. They fall back to select-and-copy where `navigator.clipboard` is missing, and resolve `false` if neither works.
- **Turn content**:
  - `work.tsx`: `Work`, `ToolItem`, `ThinkingItem`, `ApprovalItem`, `WorkItem` and `summary`.
  - `helpers.tsx`: `Helpers` and `HelperItem`.
  - `plan.tsx`: `Plan` and `progressOf`.
  - `collapse.tsx`: `Swap` and `arrive`.
  - `tool-icon.tsx`: `ToolIcon`.
  - `tool-labels.ts`: `toolLabel`, `toolCategory`, `pastLabel`, `didSummary`, `basename`, `domain` and `serverName`, plus the types `ToolCategory` and `ToolLabel`.
  - `format.ts`: `formatDuration` and `formatStep`.
- **Cards**:
  - `approval-card.tsx`: `ApprovalCard`. `approval-text.ts` supplies its wording: `approvalText`, `toolAsked`, `isCallTo`, `detailOf`, `summarize`, and the types `ApprovalText` and `ToolCall`.
  - `clarify-card.tsx`: `ClarifyCard`.
  - `secret-card.tsx`: `SecretCard`. `secret-text.ts`: `secretAskText`.
  - `side-cards.tsx`: `CommandCard` and `AsideCard`.
  - `umbrel-key.tsx`: `useUmbrelKey` and `UMBREL_HELLO`.
- **Live updates** (`live.ts`, pure functions): `isTodoTool`, `todosOf`, `planFromResult`, `withPlan`, `helperKey`, `withHelper`, `settleHelpers`, `reactionsOf`, `toggled`, `withReactions` and `withPreview`.
- **Reactions and menus**:
  - `reactions.tsx`: `TAPBACKS`, `Tapback`, `ReactionPills`, `ReactionBadge` and `useHoldToReact`.
  - `message-menu.tsx`: `MessageMenu`, `useLongPress` and the type `MenuAction`.
  - `message-actions.tsx`: `MessageActions`.
- **Mentions**:
  - `mention.tsx`: `MentionsProvider`, `useMentions`, `MentionText`, `Mention` and the type `MentionMember`.
  - `mention-card.tsx`: `MentionCard`.
  - `rehype-mentions.ts`: `rehypeMentions`.
- **Markdown**:
  - `lazy-markdown.tsx`: `Markdown`, the lazy wrapper. It shows plain text until the parser loads.
  - `markdown.tsx`: `Markdown({ text, streaming })`, the Streamdown renderer.
  - `shiki.ts`: a reduced stand-in for `shiki`, used through the alias in `vite.config.ts`. Exports `bundledLanguagesInfo`, `bundledLanguages`, `bundledThemes` and `createHighlighter`.
- **Errors and notices**:
  - `errors.ts`: `explainError`, `errorActionOf`, `ERROR_ACTION_LABEL` and the type `ErrorAction`.
  - `notices.ts`: `showNotice` and `wireNotices`.
- `playground.tsx`: `Playground`, a dev-only page with fake data (`?scene=solo|live|group|empty|media|cards|errors`).
- Styles: `composer.css`, `markdown.css`, `mention.css` and `work.css`.

## Invariants

- Components render the `types.ts` view model and never Hermes wire types. `live.ts` stays pure so the chat store can stay a thin router.
- Raw tool names are never shown. `tool-labels.ts` maps them to plain words and turns unknown names into readable text.
- Approval requests with `pattern_key` `"mcp_elicitation"` are reworded for people by `approval-text.ts`.
- Secret values typed into `SecretCard` go straight back to Hermes. The chat keeps only a receipt.
- `rehypeMentions` runs after sanitising, on the finished tree. It never changes code or links.
- `shiki.ts` must keep the same exports and shapes as `shiki`. Grammars load one at a time on first use. A language that is not listed renders as plain code without an error.
- `wireNotices()` runs only once per tab. Each notice key shows one toast, and a newer notice with the same key replaces it.
- Drafts are stored per Hermes instance, because the key prefix comes from `scoped('murmur:draft:')`.

## Side Effects

- `use-draft.ts` reads and writes `localStorage` (`murmur:draft:*`, scoped per Hermes), with a 250 ms debounce. If storage is unavailable, drafts are not saved.
- `notices.ts` subscribes to `gateway.onEvent` (`notification.show` and dismissals) and shows `sonner` toasts.
- `use-copy.ts` writes to the clipboard. `message-menu.tsx` and `reactions.tsx` add window `keydown` listeners while open, and `message-menu.tsx` calls `navigator.vibrate`.
- `use-keyboard-inset.ts` reads the visual viewport. While the keyboard is up, it sets the `--keyboard` CSS variable on `document.documentElement` and scrolls the window to the top.
- `umbrel-key.tsx` calls `connectUmbrel` from `src/state/umbrel-mcp.ts`, which adds the Umbrel MCP server to every agent. It can also open umbrelOS settings in a new tab.

## Verification

- Run: `npm test` (tests in this directory: `approval-text.test.ts`, `live.test.ts`, `notices.test.ts`, `tool-labels.test.ts`)
