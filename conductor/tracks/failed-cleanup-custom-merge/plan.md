# Implementation Plan: Auto-Clean Resolved SearchOnBing & Merge Custom Queries

## Phase 1: Core Implementation in SearchOnBingShared
- [x] Task 1.1: Implement `removeResolvedSearchOnBing(promotion: BasePromotion): void` in `src/functions/activities/search/SearchOnBingShared.ts`.
- [x] Task 1.2: Refactor custom query loading in `SearchOnBingShared.ts` to merge multiple existing candidates instead of stopping at the first match.

## Phase 2: Wire Up Success Handlers
- [x] Task 2.1: In `src/functions/activities/search/BrowserSearchOnBing.ts`, call `removeResolvedSearchOnBing(promotion)` when `this.success === true`.
- [x] Task 2.2: In `src/functions/activities/experimental/ApiSearchOnBing.ts`, call `removeResolvedSearchOnBing(promotion)` upon verified successful completion.

## Phase 3: Verification & Build
- [x] Task 3.1: Execute `npm run build` and ensure zero compilation errors.
- [x] Task 3.2: Verify with a unit test or scratch script demonstrating creation, removal, and custom query merge.
