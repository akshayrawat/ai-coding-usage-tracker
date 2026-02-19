# CLAUDE.md

## Project Overview
CLI tool that fetches per-engineer AI coding tool usage from Anthropic Claude Code, OpenAI, and Cursor admin APIs, then prints a ranked leaderboard table in the terminal.

## Tech Stack
- TypeScript, executed directly via Bun (no build step needed)
- ES modules (`"type": "module"` in package.json)
- Bun built-in `fetch` — no HTTP client library
- Bun auto-loads `.env` — no dotenv dependency
- No framework, no database, no web server

## Project Structure
```
src/
  index.ts              # Entry point — arg parsing, orchestration
  fetchers/
    types.ts            # NormalizedRecord type shared by all fetchers
    anthropic.ts        # Claude Code admin API (paginated GET)
    openai.ts           # OpenAI usage + costs APIs (paginated GET)
    cursor.ts           # Cursor filtered-usage-events (paginated POST)
  identity.ts           # Merge NormalizedRecord[] by email → MergedUser[]
  table.ts              # Format + print terminal leaderboard
```

## Key Patterns
- Each fetcher returns `NormalizedRecord[]` — a common shape with email, platform, requests, tokens, costCents
- All three fetchers run in parallel via `Promise.all`
- Missing API keys cause a warning and skip (don't crash)
- API errors per-platform are caught and logged, other platforms continue
- Cost is stored internally in cents (integer) to avoid floating-point issues

## Commands
- `bun src/index.ts` — run the CLI (default: 30 days, sort by requests)
- `bun src/index.ts --days 7 --sort cost` — custom range and sort
- `bun run typecheck` — type-check without emitting

## Environment Variables
Set in `.env` (see `.env.example`):
- `ANTHROPIC_ADMIN_API_KEY` — Anthropic admin API key (`sk-ant-admin-...`)
- `OPENAI_ORG_API_KEY` — OpenAI org-level API key
- `CURSOR_ADMIN_API_KEY` — Cursor team admin API key

## Adding a New Platform
1. Create `src/fetchers/<platform>.ts` exporting an async function that returns `NormalizedRecord[]`
2. Add the platform name to the `Platform` union in `src/fetchers/types.ts`
3. Add the display name mapping in `src/identity.ts` (`platformLabel`)
4. Wire it up in `src/index.ts` (env var check, fetch call, error handling)
