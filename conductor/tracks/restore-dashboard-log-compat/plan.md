# Implementation Plan: Restore Dashboard Compatibility & Add Dedicated Value Logging

## Phase 1: Restore Upstream Log Compatibility

- [x] Task 1.1: Restore standard upstream integer format in `ACCOUNT-END`, `RUN-END`, `FLOW`, and `POINTS` log lines in `src/index.ts`.
- [x] Task 1.2: Implement helper `formatCurrency(points: number): string | null` to compute formatted currency string `≈X.XX <symbol>` when `config.currency` is configured.

## Phase 2: Implement Concise [VALUE] Log Lines

- [x] Task 2.1: Emit `[VALUE] <username>: total <balance> (+<gained>)` cleanly without logger envelope immediately upon completion of each account.
- [x] Task 2.2: In the final run summary (both single-cluster and multi-cluster master), output `[VALUE]` lines for all accounts followed by `[VALUE] TOTAL:  total <balance> (+<gained>)`.

## Phase 3: Verification & Quality Gates

- [x] Task 3.1: Run `npm run test:log-parser` to ensure parser compatibility tests pass.
- [x] Task 3.2: Verify TypeScript compilation (`npm run build`) and Prettier/ESLint checks (`npm run lint`, `npm run format:check`).
