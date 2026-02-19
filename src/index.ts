import type { NormalizedRecord } from "./fetchers/types.js";
import { fetchAnthropicUsage } from "./fetchers/anthropic.js";
import { fetchOpenAIUsage } from "./fetchers/openai.js";
import { fetchCursorUsage } from "./fetchers/cursor.js";
import { mergeByEmail } from "./identity.js";
import { printTable, sortUsers, type SortKey } from "./table.js";

function parseArgs(): { days: number; sort: SortKey } {
  const args = process.argv.slice(2);
  let days = 30;
  let sort: SortKey = "requests";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      if (isNaN(days) || days < 1) {
        console.error("Invalid --days value, using default 30");
        days = 30;
      }
      i++;
    } else if (args[i] === "--sort" && args[i + 1]) {
      const val = args[i + 1] as SortKey;
      if (["requests", "tokens", "cost"].includes(val)) {
        sort = val;
      } else {
        console.error(`Invalid --sort value "${args[i + 1]}", using default "requests"`);
      }
      i++;
    }
  }

  return { days, sort };
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysAgoUnix(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return Math.floor(d.getTime() / 1000);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const { days, sort } = parseArgs();

  const fetchers: Promise<NormalizedRecord[]>[] = [];

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (anthropicKey) {
    fetchers.push(
      fetchAnthropicUsage(anthropicKey, daysAgoISO(days)).catch((err) => {
        console.warn(`[warn] Anthropic fetch failed: ${err.message}`);
        return [] as NormalizedRecord[];
      })
    );
  } else {
    console.warn("[warn] ANTHROPIC_ADMIN_API_KEY not set, skipping Claude Code");
  }

  // OpenAI
  const openaiKey = process.env.OPENAI_ORG_API_KEY;
  if (openaiKey) {
    fetchers.push(
      fetchOpenAIUsage(openaiKey, daysAgoUnix(days)).catch((err) => {
        console.warn(`[warn] OpenAI fetch failed: ${err.message}`);
        return [] as NormalizedRecord[];
      })
    );
  } else {
    console.warn("[warn] OPENAI_ORG_API_KEY not set, skipping OpenAI");
  }

  // Cursor
  const cursorKey = process.env.CURSOR_ADMIN_API_KEY;
  if (cursorKey) {
    const maxDays = Math.min(days, 90); // Cursor has 90-day max lookback
    fetchers.push(
      fetchCursorUsage(cursorKey, daysAgoISO(maxDays), todayISO()).catch((err) => {
        console.warn(`[warn] Cursor fetch failed: ${err.message}`);
        return [] as NormalizedRecord[];
      })
    );
  } else {
    console.warn("[warn] CURSOR_ADMIN_API_KEY not set, skipping Cursor");
  }

  if (fetchers.length === 0) {
    console.error(
      "\nNo API keys configured. Set at least one of:\n" +
        "  ANTHROPIC_ADMIN_API_KEY\n" +
        "  OPENAI_ORG_API_KEY\n" +
        "  CURSOR_ADMIN_API_KEY\n" +
        "\nSee .env.example for details."
    );
    process.exit(1);
  }

  const results = await Promise.all(fetchers);
  const allRecords = results.flat();

  if (allRecords.length === 0) {
    console.log("\nNo usage data found for the specified period.");
    return;
  }

  const merged = mergeByEmail(allRecords);
  const sorted = sortUsers(merged, sort);
  printTable(sorted, days, sort);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
