import type { NormalizedRecord } from "./types.js";

interface CursorUsageEvent {
  email: string;
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

interface CursorUsageResponse {
  events: CursorUsageEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchCursorUsage(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<NormalizedRecord[]> {
  const events: CursorUsageEvent[] = [];
  let page = 1;
  const pageSize = 100;

  const authHeader =
    "Basic " + Buffer.from(apiKey + ":").toString("base64");

  do {
    const res = await fetch(
      "https://api.cursor.com/teams/filtered-usage-events",
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startDate, endDate, page, pageSize }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cursor API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as CursorUsageResponse;
    events.push(...json.events);

    if (json.events.length < pageSize) break;
    page++;
  } while (true);

  // Aggregate events by email
  const userMap = new Map<
    string,
    { requests: number; inputTokens: number; outputTokens: number; costCents: number }
  >();

  for (const event of events) {
    const existing = userMap.get(event.email) ?? {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
    };
    existing.requests += 1;
    existing.inputTokens += event.inputTokens;
    existing.outputTokens += event.outputTokens;
    existing.costCents += event.costCents;
    userMap.set(event.email, existing);
  }

  const records: NormalizedRecord[] = [];
  for (const [email, usage] of userMap) {
    records.push({
      email,
      platform: "cursor",
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costCents: usage.costCents,
    });
  }

  return records;
}
