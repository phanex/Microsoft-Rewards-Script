# Implementation Plan: Restore Dashboard Compatibility & Add Dedicated Value Logging

## Phase 1: Restore Upstream Log Compatibility
- [ ] Task 1.1: Restore standard upstream integer format in `ACCOUNT-END`, `RUN-END`, `FLOW`, and `POINTS` log lines in `src/index.ts`.
- [ ] Task 1.2: Implement helper `formatCurrency(points: number): string | null` to compute formatted currency string `≈X.XX <symbol>` when `config.currency` is configured.

## Phase 2: Implement Concise [VALUE] Log Lines
- [ ] Task 2.1: Emit `[VALUE] Account <username> | total: <balance> | gained: <gained>` immediately upon completion of each account.
- [ ] Task 2.2: In the final run summary (both single-cluster and multi-cluster master), output `[VALUE]` lines for all accounts followed by `[VALUE] Total: <balance> | gained: <gained>`.

## Phase 3: Verification & Quality Gates
- [ ] Task 3.1: Run `npm run test:log-parser` to ensure parser compatibility tests pass.
- [ ] Task 3.2: Verify TypeScript compilation (`npm run build`) and Prettier/ESLint checks (`npm run lint`, `npm run format:check`).
