import { describe, expect, test } from "bun:test";
import { mergeByEmail } from "./identity.js";
import type { NormalizedRecord } from "./fetchers/types.js";

describe("mergeByEmail", () => {
  test("aggregates cross-platform records and deduplicates case-insensitively", () => {
    const records: NormalizedRecord[] = [
      { email: "Alice@example.com", platform: "claude", requests: 10, inputTokens: 100, outputTokens: 50, costCents: 200 },
      { email: "alice@example.com", platform: "openai", requests: 5, inputTokens: 200, outputTokens: 100, costCents: 300 },
    ];

    const result = mergeByEmail(records);

    expect(result).toHaveLength(1);
    const user = result[0];
    expect(user.requests).toBe(15);
    expect(user.tokens).toBe(450); // 100+50+200+100
    expect(user.costCents).toBe(500);
    expect(user.platforms.size).toBe(2);
    expect(user.byPlatform.size).toBe(2);
    expect(user.byPlatform.get("claude")!.requests).toBe(10);
    expect(user.byPlatform.get("openai")!.tokens).toBe(300);
  });

  test("skips records with empty email", () => {
    const records: NormalizedRecord[] = [
      { email: "", platform: "claude", requests: 10, inputTokens: 100, outputTokens: 50, costCents: 200 },
      { email: "bob@example.com", platform: "claude", requests: 5, inputTokens: 50, outputTokens: 25, costCents: 100 },
    ];

    const result = mergeByEmail(records);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("bob@example.com");
  });
});
