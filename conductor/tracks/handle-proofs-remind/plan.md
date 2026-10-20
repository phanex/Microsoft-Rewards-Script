# Implementation Plan: Handle Microsoft Security Proofs Reminder Page

## Phase 1: State Detection & Selectors

- [x] Task 1.1: Add `REMIND_PROOFS` to `LoginState` in `src/browser/auth/Login.ts`.
- [x] Task 1.2: Detect `REMIND_PROOFS` when URL matches `account.live.com` and `/proofs/remind` in `detectCurrentState`.

## Phase 2: Action Handling & Dismissal

- [x] Task 2.1: Implement `REMIND_PROOFS` branch in `handleState` to quickly check and click confirmation (`#iLooksGood`), skip (`#iShowSkip`), or submit buttons.
- [x] Task 2.2: Add fallback navigation to `ru` (return URL) parameter if dismissal does not automatically redirect away.

## Phase 3: Verification & Quality Gates

- [x] Task 3.1: Run `npm run lint` and `npm run format:check`.
- [x] Task 3.2: Verify TypeScript compilation (`npm run build`).
