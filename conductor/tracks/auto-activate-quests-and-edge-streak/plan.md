# Implementation Plan: Auto-Activate URL Quests & Edge Browsing Streak

## Phase 1: URL-Reward Quest Activation in PunchCards

- [x] Task 1.1: In `src/browser/ReactFunc.ts`, extract child `href` / `destinationUrl` in `parseQuestOffers` and include it on `QuestChild`.
- [x] Task 1.2: In `src/functions/activities/rewards/PunchCards.ts`, when a child activity has a `redirect?link=` or `urlreward` href, follow/fetch the redirect URL with account session cookies so Microsoft registers the activation.

## Phase 2: Edge Browsing Streak Auto-Activation

- [x] Task 2.1: In `src/functions/activities/experimental/EdgeBrowsing.ts`, enhance streak activation so that when `streak.isEnabled === false`, it follows `destinationUrl` (`https://www.microsoft.com/en-us/edge/launch/rewards-browsing-streak1` -> `https://rewards.bing.com/promo/edge-browsing-streak...`) if server action activation did not complete it.
- [x] Task 2.2: Also ensure the Edge flyout promotions (`edgeHighValueActionPromotions` / `promotionalItems`) are checked and processed.

## Phase 3: Verification & Quality Gates

- [x] Task 3.1: Run `npm run test:log-parser` to ensure parser compatibility.
- [x] Task 3.2: Verify TypeScript compilation (`npm run build`) and Prettier/ESLint checks (`npm run lint`, `npm run format:check`).
