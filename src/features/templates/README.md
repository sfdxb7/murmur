# templates

## Overview

Ready-made agents. Each template has a name, a colour, a purpose and a short personality. Making an agent starts from the template grid, then moves to the agent editor from [../agents/README.md](../agents/README.md).

## Interface

- `templates.ts`:
  - `TEMPLATES` and `templateById(id)`.
  - `suggestName`, `draftFromTemplate` and `templateStarters`.
  - Types: `Template` and `Starter`.
- `template-grid.tsx`: `TemplateGrid`, the template cards and a way to start from scratch.
- `new-agent-sheet.tsx`: `NewAgentSheet`. The grid fades out and the editor fades in. Back returns to the grid.

## Invariants

- Picking a template fills in the editor. The template's words become the agent's own (Custom) personality, so the person can read and change every line before creating the agent.
- The template id is kept on the agent at `ui_meta.murmur.template`, so `templateStarters()` can offer that agent's starter prompts in a new chat.
- `NewAgentSheet` keeps one height while switching between the grid and the editor.
- The grid uses six column tracks so that it always ends evenly, whatever the number of cards.

## Side Effects

- None directly. The caller creates the agent through `NewAgentSheet`'s `onSubmit` prop.

## Verification

- Run: `npm test`
