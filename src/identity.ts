import type { NormalizedRecord, Platform } from "./fetchers/types.js";

export interface PlatformUsage {
  requests: number;
  tokens: number;
  costCents: number;
}

export interface MergedUser {
  email: string;
  requests: number;
  tokens: number;
  costCents: number;
  platforms: Set<Platform>;
  byPlatform: Map<Platform, PlatformUsage>;
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
    if (!r.email) continue;
    const key = r.email.toLowerCase();
    let user = map.get(key);
    if (!user) {
      user = {
        email: r.email,
        requests: 0,
        tokens: 0,
        costCents: 0,
        platforms: new Set(),
        byPlatform: new Map(),
      };
      map.set(key, user);
    }
    const tokens = r.inputTokens + r.outputTokens;
    user.requests += r.requests;
    user.tokens += tokens;
    user.costCents += r.costCents;
    user.platforms.add(r.platform);

    const plat = user.byPlatform.get(r.platform) ?? { requests: 0, tokens: 0, costCents: 0 };
    plat.requests += r.requests;
    plat.tokens += tokens;
    plat.costCents += r.costCents;
    user.byPlatform.set(r.platform, plat);
  }

  return Array.from(map.values());
}
