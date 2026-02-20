# AI Coding Usage Tracker

A CLI tool that pulls per-engineer usage data from **Anthropic Claude Code**, **OpenAI**, and **Cursor** admin APIs and prints a ranked leaderboard in your terminal.

```
AI Coding Usage Leaderboard (Last 30 days)
════════════════════════════════════════════════════════════════════════════════
  #   User                Requests   Tokens      Cost   Tools
────────────────────────────────────────────────────────────────────────────────
  1   alice@company.com        342     2.1M   $127.40   Claude, OpenAI
        Claude                 220     1.5M    $95.00
        OpenAI                 122   620.3K    $32.40
  2   bob@company.com          285     1.8M    $98.20   Claude, OpenAI, Cursor
        Claude                 150     1.0M    $60.00
        OpenAI                  85   500.0K    $25.20
        Cursor                  50   300.0K    $13.00
  3   carol@company.com        201     1.2M    $67.50   Claude
════════════════════════════════════════════════════════════════════════════════
```

## Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+

### Install

```bash
git clone <repo-url>
cd ai-coding-usage-tracker
bun install
```

### Configure API Keys

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

| Variable | Source | Required |
|---|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | [Anthropic Admin Console](https://console.anthropic.com/) — needs admin-level key (`sk-ant-admin-...`) | No |
| `OPENAI_ORG_API_KEY` | [OpenAI Admin Keys](https://platform.openai.com/organization/admin-keys) — requires an Admin API key (not a regular API key), org Owner role needed | No |
| `CURSOR_ADMIN_API_KEY` | Cursor team admin settings | No |

At least one key must be set. Platforms with missing keys are skipped with a warning.

## Usage

```bash
# Default: last 30 days, sorted by requests
bun src/index.ts

# Last 7 days
bun src/index.ts --days 7

# Sort by cost or tokens
bun src/index.ts --sort cost
bun src/index.ts --sort tokens
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--days <n>` | `30` | Number of days to look back |
| `--sort <key>` | `requests` | Sort by `requests`, `tokens`, or `cost` |

> **Note:** Cursor has a 90-day maximum lookback. If `--days` exceeds 90, the Cursor query is capped at 90 days.

### Columns

| Column | Description |
|---|---|
| **#** | Rank by the chosen sort key (default: requests) |
| **User** | Email address (or OpenAI user ID) identifying the person |
| **Requests** | Number of sessions (Claude Code), API requests (OpenAI), or events (Cursor) |
| **Tokens** | Total input + output + cache tokens across all models |
| **Cost** | Estimated cost in USD, summed across platforms |
| **Tools** | Which platforms the user has activity on (Claude, OpenAI, Cursor) |

## How It Works

1. Fetches usage data from all configured platforms in parallel
2. Normalizes each platform's response into a common record format
3. Merges users across platforms by email address
4. Ranks and prints the leaderboard table

If a platform API call fails, the error is logged and the remaining platforms still display.

## Supported Platforms

| Platform | API | Data Returned |
|---|---|---|
| **Claude Code** | Anthropic Admin API | Sessions, tokens, cost per user email |
| **OpenAI** | Organization Usage API | Requests, tokens, cost per user ID |
| **Cursor** | Team Admin API | Events per user email (aggregated into requests, tokens, cost) |

### Identity Resolution

Users are matched across platforms by email address. OpenAI may only return a `user_id` instead of an email — these appear as separate rows showing the ID.

## License

MIT
