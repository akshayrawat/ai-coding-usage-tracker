import type { NormalizedRecord } from "./types.js";

interface ModelBreakdown {
  model: string;
  tokens: {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
  };
  estimated_cost: {
    currency: string;
    amount: number; // cents (minor currency units)
  };
}

interface ClaudeCodeUsageEntry {
  date: string;
  actor: {
    type: string;
    email_address?: string;
  };
  core_metrics: {
    num_sessions: number;
  };
  model_breakdown: ModelBreakdown[];
}

interface ClaudeCodeUsageResponse {
  data: ClaudeCodeUsageEntry[];
  has_more: boolean;
  next_page?: string;
}

/** Fetch all pages for a single day */
async function fetchDay(
  apiKey: string,
  date: string
): Promise<ClaudeCodeUsageEntry[]> {
  const entries: ClaudeCodeUsageEntry[] = [];
  let page: string | undefined;

  do {
    const url = new URL(
      "https://api.anthropic.com/v1/organizations/usage_report/claude_code"
    );
    url.searchParams.set("starting_at", date);
    url.searchParams.set("limit", "1000");
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as ClaudeCodeUsageResponse;
    entries.push(...json.data);
    page = json.has_more ? json.next_page : undefined;
  } while (page);

  return entries;
}

/** Generate YYYY-MM-DD strings for each day in [startDate, today] */
function dateSeries(startDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  while (current <= today) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const CONCURRENCY = 5;

export async function fetchAnthropicUsage(
  apiKey: string,
  startDate: string
): Promise<NormalizedRecord[]> {
  const dates = dateSeries(startDate);
  const allEntries: ClaudeCodeUsageEntry[] = [];

  // Fetch days in batches to avoid hammering the API
  for (let i = 0; i < dates.length; i += CONCURRENCY) {
    const batch = dates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((d) => fetchDay(apiKey, d)));
    for (const entries of results) {
      allEntries.push(...entries);
    }
  }

  const records: NormalizedRecord[] = [];
  for (const entry of allEntries) {
    const email = entry.actor?.email_address;
    if (!email) continue;

    let inputTokens = 0;
    let outputTokens = 0;
    let costCents = 0;

    for (const m of entry.model_breakdown) {
      inputTokens += m.tokens.input;
      outputTokens += m.tokens.output;
      costCents += m.estimated_cost.amount;
    }

    records.push({
      email,
      platform: "claude",
      requests: entry.core_metrics.num_sessions,
      inputTokens,
      outputTokens,
      costCents,
    });
  }

  return records;
}
