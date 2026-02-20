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
  amount: { value: number; currency: string };
}

interface CostResponse {
  data: { results: CostBucketEntry[] }[];
  has_more: boolean;
  next_page?: string;
}

interface OrgUser {
  object: string;
  id: string;
  email: string;
  name: string;
  role: string;
}

interface OrgUsersResponse {
  data: OrgUser[];
  has_more: boolean;
  last_id?: string;
}

/** Fetch all org members to build user_id → email map */
async function fetchOrgMembers(apiKey: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let after: string | undefined;

  do {
    const url = new URL("https://api.openai.com/v1/organization/users");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      // Non-fatal: fall back to user_email from usage data
      console.warn(`[warn] OpenAI org members fetch failed: ${res.status}`);
      break;
    }

    const json = (await res.json()) as OrgUsersResponse;
    for (const user of json.data) {
      map.set(user.id, user.email);
    }
    after = json.has_more ? json.data[json.data.length - 1]?.id : undefined;
  } while (after);

  return map;
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

  const [usagePages, costPages, orgMembers] = await Promise.all([
    fetchAllPages<UsageResponse>(
      "https://api.openai.com/v1/organization/usage/completions",
      apiKey,
      { start_time: startTime, bucket_width: "1d", "group_by[]": "user_id", limit: "31" }
    ),
    fetchAllPages<CostResponse>(
      "https://api.openai.com/v1/organization/costs",
      apiKey,
      { start_time: startTime, bucket_width: "1d", limit: "180" }
    ).catch((err) => {
      console.warn(`[warn] OpenAI costs fetch failed: ${err.message}`);
      return [] as CostResponse[];
    }),
    fetchOrgMembers(apiKey),
  ]);

  // Sum total org cost (in USD)
  let totalCostUsd = 0;
  for (const page of costPages) {
    for (const bucket of page.data) {
      for (const entry of bucket.results) {
        totalCostUsd += Number(entry.amount?.value) || 0;
      }
    }
  }

  // Merge org member emails with any emails from usage data
  const emailMap = new Map<string, string>(orgMembers);
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
        existing.requests += entry.num_model_requests ?? 0;
        existing.inputTokens += entry.input_tokens ?? 0;
        existing.outputTokens += entry.output_tokens ?? 0;
        userMap.set(entry.user_id, existing);
      }
    }
  }

  // OpenAI costs API doesn't support per-user grouping, so distribute
  // total org cost proportionally by each user's token share.
  const totalCostCents = Math.round(totalCostUsd * 100);
  let orgTotalTokens = 0;
  for (const usage of userMap.values()) {
    orgTotalTokens += usage.inputTokens + usage.outputTokens;
  }

  const records: NormalizedRecord[] = [];
  for (const [userId, usage] of userMap) {
    const userTokens = usage.inputTokens + usage.outputTokens;
    const costCents = orgTotalTokens > 0
      ? Math.round(totalCostCents * (userTokens / orgTotalTokens))
      : 0;
    records.push({
      email: emailMap.get(userId) ?? userId,
      platform: "openai",
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costCents,
    });
  }

  return records;
}
