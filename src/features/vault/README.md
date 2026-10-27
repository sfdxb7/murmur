# vault

## Overview

An agent's passwords: the logins, payment cards and addresses it fills in for one site each, without seeing them. Hermes keeps them encrypted. State and actions come from `src/state/vault.ts`.

## Interface

- `index.ts` re-exports `VaultSheet`.
- `vault-sheet.tsx`: `VaultSheet`, which lists, adds and removes vault entries.
- `card-face.tsx`: `CardFace`, a payment card drawn in its network's colours. It fills in as the number is typed.
- `site-icon.tsx`: `SiteIcon` and `siteKey(host)` (for example "app.notion.so" becomes "notion").
- `vault.css`.

## Invariants

- `SiteIcon` never fetches anything. No favicon service learns which sites an agent signs in to. A site without a known mark gets its initial on a colour that is always the same for that site.
- After a card is saved, only its last four digits are known.
- Card and login handling uses helpers from `src/state/vault.ts`: `cardBrand`, `cardNumberOk`, `formatCardNumber`, `parseExpiry`, `identifierType` and `toWire`.

## Side Effects

- `useVaultActions` in `src/state/vault.ts` changes the agent's vault on Hermes (for example the gateway RPC `vault.remove`).

## Verification

- Run: `npm test`
