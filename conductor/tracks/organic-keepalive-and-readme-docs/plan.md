# Implementation Plan: Organic Keep-Alive Searches & Comprehensive README Documentation

## Phase 1: Configuration, Schema & Environment Overrides

- [x] Task 1.1: Add `doKeepAliveSearch` to `Config['workers']` and `keepAliveSearches: { min: number, max: number }` to `Config['searchSettings']` in `src/interface/Config.ts`.
- [x] Task 1.2: Update Zod validation and defaults in `src/util/Validator.ts` (`doKeepAliveSearch` defaults to `false`, `keepAliveSearches` defaults to `{ min: 3, max: 5 }`).
- [x] Task 1.3: Add environment overrides in `src/util/ConfigEnvOverrides.ts`:
    - `CONFIG_WORKER_KEEP_ALIVE_SEARCH`
    - `CONFIG_SEARCH_KEEP_ALIVE_MIN`
    - `CONFIG_SEARCH_KEEP_ALIVE_MAX`
- [x] Task 1.4: Update `config.example.json` with new options and comments.

## Phase 2: Keep-Alive Search Implementation

- [x] Task 2.1: Implement `doKeepAliveSearches(page: Page): Promise<number>` in `src/functions/activities/search/BrowserSearch.ts`:
    - Determine random search count between `min` and `max`.
    - Draw search queries from `SearchQueryQueue`.
    - Loop through searches performing Bing search, result scrolling, and random link visits.
    - Log execution under `SEARCH-KEEPALIVE`.
- [x] Task 2.2: Expose `doKeepAliveSearches` in `src/functions/Activities.ts`.
- [x] Task 2.3: Wire keep-alive search into `src/index.ts` account task execution flow.

## Phase 3: Comprehensive Documentation & Quality Gates

- [x] Task 3.1: Update `README.md` to document:
    - `workers.doKeepAliveSearch` and `searchSettings.keepAliveSearches` (purpose for Bing Star Bonus / organic activity).
    - Recent enhancements: React Flight stream chunk dereferencing, auto-cleanup of `failed.json` + `custom.json` merging, 14-day DSE streak bonus parameter, and Rewards App weekly automation.
- [x] Task 3.2: Verify TypeScript compilation (`npm run build`) and Prettier code style (`npm run format:check`).
