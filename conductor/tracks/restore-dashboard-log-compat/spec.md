# Specification: Restore Dashboard Compatibility & Add Dedicated Value Logging

## Overview

Restore original upstream log formatting in `Microsoft Rewards Script` to maintain 100% compatibility with `scripts/api/logParser.js` and external dashboards. Move currency and financial estimations to concise, dedicated `[VALUE]` log lines rendered both immediately upon account completion and summarized together at the end of the run.

## Functional Requirements

1. **Upstream Compatibility**:
    - `ACCOUNT-END`, `RUN-END`, `FLOW`, and `POINTS` lines must contain purely integer values for numeric point fields (`pointsGained`, `previousBalance`, `currentBalance`, `total`) without parenthesized additions `(≈X.XX €)`.
2. **Dedicated Account Value Logging**:
    - When `config.currency` is configured, log an immediate concise value line when an account completes:
      `[VALUE] Account <username> | total: ≈X.XX <symbol> | gained: ≈Y.YY <symbol>`
    - Use username (email prefix) instead of full email address to keep logs clean and readable.
3. **Dedicated Run End Summary**:
    - At the conclusion of the run (both in single-cluster and multi-cluster modes), list the `[VALUE]` lines for all processed accounts.
    - Conclude with a single grand total line:
      `[VALUE] Total: ≈X.XX <symbol> | gained: ≈Y.YY <symbol>`
4. **Configuration & Testing**:
    - Retain `currency` configuration settings, validator schemas, and environment variable overrides (`CONFIG_CURRENCY`).
    - Ensure all `logParser.test.js` tests pass without regressions.

## Non-Functional Requirements

- Maintain code formatting standards via Prettier and ESLint.
- TypeScript build must compile without errors or warnings.
