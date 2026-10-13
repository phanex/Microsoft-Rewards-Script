# Development Workflow

## Principles
1. **Spec-Driven Development (SDD):** Define requirements, error cases, and architecture in `spec.md` before writing implementation code.
2. **Quality & Validation:** All TypeScript changes must compile cleanly (`npm run build`) without type errors or lint warnings.
3. **Non-Disruptive Resilience:** Background error recording must never crash or block bot runs. Disk writes should fail gracefully.
4. **Git Hygiene:** Clean, atomic commits with conventional commit messages (`feat(...)`, `fix(...)`, `refactor(...)`).

## Testing & Verification
- Compile check: `npm run build`
- Linter verification: `npm run lint`
- Live verification: Targeted single-account runs with debug logging (`$env:SINGLE_ACCOUNT = '...'; node ./dist/index.js`)
