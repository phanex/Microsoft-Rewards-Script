# Specification: Handle Microsoft Security Proofs Reminder Page

## Overview

When authenticating or verifying Bing sessions, Microsoft occasionally redirects users to `https://account.live.com/proofs/remind` ("Is your security info still accurate?"). The bot currently flags this as `UNKNOWN`, causing ~55-second timeouts across both mobile and desktop authentication loops. This track introduces automated handling for the proofs reminder page so the bot can dismiss it promptly and proceed.

## Functional Requirements

1. **State Detection**:
    - Detect `REMIND_PROOFS` state in `src/browser/auth/Login.ts` when navigation reaches `account.live.com/proofs/remind`.
2. **Automated Dismissal**:
    - In `handleState('REMIND_PROOFS')`, attempt to click confirmation or dismiss actions:
        - `#iLooksGood`, `#idLooksGood`, `input[name="iLooksGood"]`, `input[value*="Looks good" i]`, `button:has-text("Looks good")`
        - `#iShowSkip`, `#idBtn_Skip`, `a#iShowSkip` ("Remind me later" / "Skip")
        - `#idSIButton9`, `input[type="submit"]`
    - If buttons are not matched by ID, match candidate action elements by label (`/Looks good|Remind me later|Skip|Next|Continue|Все правильно|Нагадати/i`).
    - If still on `proofs/remind` after dismissal attempt, navigate to the `ru` (return URL) search parameter if present.
3. **Bing Session Verification Flow**:
    - Ensure `verifyBingSession` handles `REMIND_PROOFS` without timing out or failing.

## Non-Functional Requirements

- Fast execution without multi-second delays between selector checks.
- Maintain TypeScript build integrity and linting/formatting rules.
