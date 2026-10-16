# Product Definition

## Vision

**Microsoft Rewards Script** is an advanced, automated bot designed to safely, reliably, and efficiently complete daily tasks, search queries, punchcards, and promotional activities on Microsoft Rewards (supporting the modern React Server Components dashboard) across multiple user accounts.

## Core Features & Capabilities

1. **Automated Search Engine Activities:**
    - Desktop and Mobile Bing searches with randomized human-like delays, mouse scrolling, and link visiting.
    - Omnibox / Default Search Engine (DSE) attribution spoofing to accumulate monthly high-value action streaks.
    - Search on Bing promotional card solver with query dictionaries and rich widget triggers.

2. **Punchcards & Quests:**
    - Automatic discovery of parent punchcards and child offers via React Server Components (RSC) parsing.
    - Rewards App exclusive weekly punchcard automation with desktop client headers.

3. **Daily Sets & Streaks:**
    - Automated Daily Set completion (polls, quizzes, click offers).
    - Daily app check-in via mobile app API tokens.
    - Visual search streak automation and streak protection guards.

4. **Multi-Account & Session Isolation:**
    - Headless and headful execution via Patchright (anti-bot hardened Chromium).
    - Independent SQLite session databases and device fingerprint generation per account and platform (desktop/mobile).
    - Anti-detection delays, proxy support, and configurable cluster workers.
