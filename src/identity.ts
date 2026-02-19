import type { NormalizedRecord, Platform } from "./fetchers/types.js";

export interface MergedUser {
  email: string;
  requests: number;
  tokens: number;
  costCents: number;
  platforms: Set<Platform>;
}

const platformLabel: Record<Platform, string> = {
  claude: "Claude",
  openai: "OpenAI",
  cursor: "Cursor",
};

export function platformDisplayName(p: Platform): string {
  return platformLabel[p];
}

export function mergeByEmail(records: NormalizedRecord[]): MergedUser[] {
  const map = new Map<string, MergedUser>();

  for (const r of records) {
    const key = r.email.toLowerCase();
    let user = map.get(key);
    if (!user) {
      user = {
        email: r.email,
        requests: 0,
        tokens: 0,
        costCents: 0,
        platforms: new Set(),
      };
      map.set(key, user);
    }
    user.requests += r.requests;
    user.tokens += r.inputTokens + r.outputTokens;
    user.costCents += r.costCents;
    user.platforms.add(r.platform);
  }

  return Array.from(map.values());
}
