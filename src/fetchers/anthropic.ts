import type { NormalizedRecord } from "./types.js";

interface ClaudeCodeUsageEntry {
  email: string;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  lines_of_code: number;
}

interface ClaudeCodeUsageResponse {
  data: ClaudeCodeUsageEntry[];
  has_more: boolean;
  next_cursor?: string;
}

export async function fetchAnthropicUsage(
  apiKey: string,
  startDate: string
): Promise<NormalizedRecord[]> {
  const records: NormalizedRecord[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(
      "https://api.anthropic.com/v1/organizations/usage_report/claude_code"
    );
    url.searchParams.set("starting_at", startDate);
    if (cursor) url.searchParams.set("cursor", cursor);

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

    for (const entry of json.data) {
      records.push({
        email: entry.email,
        platform: "claude",
        requests: entry.session_count,
        inputTokens: entry.input_tokens,
        outputTokens: entry.output_tokens,
        costCents: Math.round(entry.cost_usd * 100),
      });
    }

    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);

  return records;
}
