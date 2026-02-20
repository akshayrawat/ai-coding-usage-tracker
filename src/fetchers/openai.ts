import type { NormalizedRecord } from "./types.js";

interface UsageBucketEntry {
  user_id: string;
  user_email?: string;
  input_tokens: number;
  output_tokens: number;
  num_model_requests: number;
}

interface UsageResponse {
  data: { results: UsageBucketEntry[] }[];
  has_more: boolean;
  next_page?: string;
}

interface CostBucketEntry {
  user_id: string;
  user_email?: string;
  amount: {
    value: string; // decimal string in USD
    currency: string;
  };
}

interface CostResponse {
  data: { results: CostBucketEntry[] }[];
  has_more: boolean;
  next_page?: string;
}

async function fetchAllPages<T extends { has_more: boolean; next_page?: string }>(
  baseUrl: string,
  apiKey: string,
  params: Record<string, string>
): Promise<T[]> {
  const pages: T[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    if (pageToken) url.searchParams.set("page", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as T;
    pages.push(json);
    pageToken = json.has_more ? json.next_page : undefined;
  } while (pageToken);

  return pages;
}

export async function fetchOpenAIUsage(
  apiKey: string,
  startUnix: number
): Promise<NormalizedRecord[]> {
  const startTime = String(startUnix);

  const [usagePages, costPages] = await Promise.all([
    fetchAllPages<UsageResponse>(
      "https://api.openai.com/v1/organization/usage/completions",
      apiKey,
      { start_time: startTime, bucket_width: "1d", "group_by[]": "user_id" }
    ),
    fetchAllPages<CostResponse>(
      "https://api.openai.com/v1/organization/costs",
      apiKey,
      { start_time: startTime, "group_by[]": "user_id" }
    ),
  ]);

  // Build user_id → email mapping from both usage and cost results
  const emailMap = new Map<string, string>();

  // Aggregate usage by user_id
  const userMap = new Map<
    string,
    { requests: number; inputTokens: number; outputTokens: number }
  >();

  for (const page of usagePages) {
    for (const bucket of page.data) {
      for (const entry of bucket.results) {
        if (!entry.user_id) continue;
        if (entry.user_email) emailMap.set(entry.user_id, entry.user_email);
        const existing = userMap.get(entry.user_id) ?? {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
        };
        existing.requests += entry.num_model_requests;
        existing.inputTokens += entry.input_tokens;
        existing.outputTokens += entry.output_tokens;
        userMap.set(entry.user_id, existing);
      }
    }
  }

  // Aggregate costs by user_id
  const costMap = new Map<string, number>();
  for (const page of costPages) {
    for (const bucket of page.data) {
      for (const entry of bucket.results) {
        if (!entry.user_id) continue;
        if (entry.user_email) emailMap.set(entry.user_id, entry.user_email);
        const dollars = parseFloat(entry.amount.value);
        const cents = Math.round(dollars * 100);
        costMap.set(
          entry.user_id,
          (costMap.get(entry.user_id) ?? 0) + cents
        );
      }
    }
  }

  const records: NormalizedRecord[] = [];
  for (const [userId, usage] of userMap) {
    records.push({
      email: emailMap.get(userId) ?? userId,
      platform: "openai",
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costCents: costMap.get(userId) ?? 0,
    });
  }

  return records;
}
