# Specification: Auto-Activate URL Quests & Edge Browsing Streak

## Overview

Enable full automation for activating promotional punchcard quests (such as Duolingo and multi-day quests requiring URL-based activation) and Edge Browsing Streak (via flyout activation and `rewards-browsing-streak1` redirection), ensuring accounts participate in all available campaigns seamlessly.

## Functional Requirements

1. **URL-Reward & Quest Activation**:
    - In `PunchCards.ts`, inspect quest children: if a child is an active redirect link (`channel=urlreward` or `redirect?link=...`), fetch/follow the redirect URL (or claim via HTTP GET with account cookies) to trigger backend activation, instead of or in addition to `reportServerAction`.
    - On the quest page itself, parse the live `href` of any `<a>` element pointing to `rewards.bing.com/redirect?` and execute the request.
    - When `skipNonPointTasks` is `false` (or configured), ensure all parent quests and their children are processed.

2. **Edge Browsing Streak Auto-Activation**:
    - In `EdgeBrowsing.ts`, when checking if the streak is active:
        - Check `streak.isEnabled`.
        - If not enabled, attempt activation via:
            1. The server action using `activationOfferId` (`edge_flight_1_ww_treatment_eligible`) and `activationHash` from the streak model.
            2. If absent or not activating, follow the destination URL `https://www.microsoft.com/en-us/edge/launch/rewards-browsing-streak1` (or `https://rewards.bing.com/promo/edge-browsing-streak?form=ML2WHL...` / `https://www.bing.com/?rwgbopen=1&FORM=rwbsl1`) using the Edge session/cookies.
    - Confirm activation in the refreshed streak status.

3. **Flyout Promotional Items Processing**:
    - In `MorePromotions.ts`, also inspect and solve actionable promotions from `dashboard.promotionalItems` and `edgeHighValueActionPromotions` that are currently skipped.

## Non-Functional Requirements

- Fully maintain existing logging standards and dashboard compatibility.
- Pass ESLint (`npm run lint`), Prettier (`npm run format:check`), and tests (`npm run test:log-parser`).
