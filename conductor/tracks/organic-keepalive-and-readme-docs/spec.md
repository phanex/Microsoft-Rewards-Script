# Specification: Organic Keep-Alive Searches & Comprehensive README Documentation

## Overview

To improve user trust scoring for Microsoft Rewards' Bing Star Bonus and simulate natural user behavior throughout the day, this track introduces an organic "Keep-Alive" search worker (`doKeepAliveSearch`). When enabled, the bot conducts a small, configurable batch of casual Bing searches (default 3–5) with natural scrolling and result interaction, executed as an activity without waiting on points.
Additionally, this track updates `README.md` to document all recent architectural enhancements made to the repository.

---

## Functional Requirements

### 1. Configuration & Environment Overrides

- **`workers.doKeepAliveSearch`**: Boolean setting in `config.json` (default: `false` in validator).
- **`searchSettings.keepAliveSearches`**: Object with `{ min: 3, max: 5 }` defining the random search count range.
- **Environment Overrides** (`src/util/ConfigEnvOverrides.ts`):
    - `CONFIG_WORKER_KEEP_ALIVE_SEARCH` -> `workers.doKeepAliveSearch` (`bool`)
    - `CONFIG_SEARCH_KEEP_ALIVE_MIN` -> `searchSettings.keepAliveSearches.min` (`number`)
    - `CONFIG_SEARCH_KEEP_ALIVE_MAX` -> `searchSettings.keepAliveSearches.max` (`number`)
- **Schema & Validation**: Updated `src/interface/Config.ts` and `src/util/Validator.ts`.

### 2. Keep-Alive Search Implementation

- In `src/functions/activities/search/BrowserSearch.ts`:
    - Implement `doKeepAliveSearches(page: Page): Promise<number>`
    - Computes a random target count between `min` and `max` (3 to 5 by default).
    - Uses `SearchQueryQueue` to draw high-quality queries from configured query sources.
    - Performs Bing navigation, natural page interaction:
        - Scrolls results when `scrollRandomResults` is enabled.
        - Clicks and briefly visits an organic result link when `clickRandomResults` is enabled.
        - Applies standard randomized delays between searches.
    - Does not poll the user rewards API for point increments (pure activity simulation).
- Exposed via `Activities.ts` and wired into `index.ts` task flow as a distinct run stage.

### 3. Documentation Update (`README.md`)

- Document `workers.doKeepAliveSearch` and `searchSettings.keepAliveSearches` under Workers and Search Settings tables.
- Document recent architectural additions:
    - React Flight stream chunk dereferencing (`snapshotQuestList`) for robust punchcard execution.
    - Auto-cleanup of resolved entries in `failed.json` and custom query mapping.
    - Default Search Engine (DSE) 14-day streak parameter (`FORM=EDGBS`).
    - Weekly Rewards App punchcard automation.

---

## Non-Functional Requirements

- **Execution Speed:** Fast footprint (~1.5–2 minutes per account).
- **Safety:** Independent of quota state; cannot loop indefinitely.
- **Code Standards:** 100% clean TypeScript build (`npm run build`) and Prettier formatting (`npm run format:check`).

---

## Acceptance Criteria

- [ ] `workers.doKeepAliveSearch` is fully typed, validated, and overrideable via environment variables.
- [ ] When enabled, bot runs 3–5 casual searches with scrolling/clicking and logs progress under `[SEARCH-KEEPALIVE]`.
- [ ] Does not crash or hang if query queue is exhausted or browser page is closed.
- [ ] `README.md` clearly explains the purpose of keep-alive searches for Bing Star Bonus along with other recent features.
- [ ] Project builds cleanly (`npm run build`) and passes style check (`npm run format:check`).
