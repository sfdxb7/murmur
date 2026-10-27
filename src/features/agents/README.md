# agents

## Overview

Creating, editing, importing and exporting agents, and picking agents for a new group.

## Interface

- `agent-editor.tsx`: the agent editor.
  - Components: `AgentEditor`, `AgentEditorSheet` and `AgentFields` (props `AgentFieldsProps`).
  - Helpers: `personalityPrompt` and `canSubmit`.
  - Types: `Personality`, `AgentDraft` and `Taken`.
  - A preview orb shows the agent and updates as you edit the name, colour, purpose and personality.
- `import-agent.tsx`:
  - `useImportAgent` picks an exported agent file and adds it to the roster, then calls `onDone`.
  - `exportWithToast` exports an agent and shows a toast.
- `new-group.tsx`: `NewGroupSheet` and the type `GroupCandidate`, for picking several agents to talk to at once.

## Invariants

- An agent's Buddy is seeded from its id on every screen. While you create an agent, the preview uses the id it will get (`slugFor(name)`). The preview updates shortly after you stop typing, not on every keystroke.
- `canSubmit` decides whether a draft can be saved. A name that is already taken is reported in place (`Taken`).

## Side Effects

- Import and export call `importAgent` and `exportAgent` from `src/state/backups.ts`. These create an agent on Hermes or download a file.
- Invalidates the agents query (`agentsKey`) after changes.

## Verification

- Run: `npm test`
