# Technology Stack

## Runtime & Engine
- **Node.js:** >= 22.0.0 (Supports modern ES modules, worker threads, clustering)
- **Language:** TypeScript 6.0+ (Target: ES2022, Strict type-checking, Bundler module resolution)

## Core Libraries & Automation Frameworks
- **Browser Automation:** `patchright` (Hardened Playwright Chromium fork resistant to bot detection & Cloudflare/Akamai fingerprinting)
- **Fingerprinting:** `fingerprint-generator` & `fingerprint-injector` (Generates and injects consistent OS, screen, audio, and webgl profiles)
- **Cursor Emulation:** `ghost-cursor-playwright-port` (Human-like bezier-curve mouse movements and realistic click dispatching)
- **Session & Storage:** SQLite (`better-sqlite3` via sessionDb utils) storing cookies and fingerprints per account
- **HTTP & Networking:** `impit` (HTTP client), standard Node.js `fetch` / `http`

## Build & Testing Tooling
- **Build System:** `tsc` (TypeScript Compiler) + custom assets copy script (`scripts/main/copyAssets.js`)
- **Linting & Formatting:** ESLint 10+, Prettier
- **Packaging / Execution:** Node ESM (`scripts/main/*.js`) + Node CommonJS/ES2022 (`dist/index.js`)
