# Specification: Auto-Clean Resolved SearchOnBing & Merge Custom Queries

## Track Type

- **Type:** Feature / Bug Fix
- **Track ID:** `failed-cleanup-custom-merge`

## Overview

Currently, `SearchOnBingShared` records failed promotional search activities into `failed.json` when query limits are exhausted or when activation fails. However, once an activity is successfully completed (e.g. on a subsequent run after queries are updated), the entry in `failed.json` is never removed, accumulating outdated entries indefinitely.
Additionally, when loading custom queries, `SearchOnBingShared` picks the first existing `custom.json` candidate from a list of paths and ignores the others. If a user maintains a local `config/custom.json`, they completely miss out on queries provided in the repository's `src/functions/custom.json`.

This track introduces two key capabilities:

1. **Auto-Cleanup of `failed.json`:** Automatically removes resolved offers from `failed.json` whenever `SearchOnBing` succeeds. If all entries are cleared, deletes or empties `failed.json`.
2. **Deep Merge of Custom Query Sources:** Merges custom queries from both the built-in repository distribution and local configuration overrides, ensuring local queries take precedence for matching offer IDs without discarding distinct entries from the repository.

## Functional Requirements

1. **Resolve & Remove Failed Entries:**
    - Add `removeResolvedSearchOnBing(promotion: BasePromotion): void` in `SearchOnBingShared.ts`.
    - On successful completion of `BrowserSearchOnBing` or `ApiSearchOnBing`, invoke `removeResolvedSearchOnBing(promotion)`.
    - The removal must match by `promotion.offerId`.
    - If the resulting list of failed entries is empty, safely delete `failed.json` (or write empty array `[]`).
2. **Multi-Source Custom Query Merging:**
    - Read and combine all existing `custom.json` candidates (`config/custom.json`, `dist/functions/custom.json`, `custom.json`, `src/functions/custom.json`).
    - Merge queries by `title` / `offerId`, deduplicating queries while allowing local configurations to prepend/override repository queries.
3. **Resilience & Non-Disruptive I/O:**
    - Any disk I/O errors (EACCES, ENOENT, read/write permissions) must be caught and logged silently/gracefully without interrupting bot execution.

## Acceptance Criteria

- [ ] Successful completion of an offer previously recorded in `failed.json` removes it from `failed.json`.
- [ ] If all failed entries are resolved, `failed.json` does not retain zombie entries.
- [ ] Custom queries present in `src/functions/custom.json` are still loaded even if a user has a `config/custom.json` containing other queries.
- [ ] Clean build via `npm run build`.
