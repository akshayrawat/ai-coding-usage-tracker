import { describe, expect, test } from "bun:test";
import { formatTokens, sortUsers, renderTableLines } from "./table.js";
import type { MergedUser } from "./identity.js";

function makeUser(overrides: Partial<MergedUser> & { email: string }): MergedUser {
  return {
    requests: 0,
    tokens: 0,
    costCents: 0,
    platforms: new Set(["claude"]),
    byPlatform: new Map([["claude", { requests: 0, tokens: 0, costCents: 0 }]]),
    ...overrides,
  };
}

describe("formatTokens", () => {
  test("formats boundary conditions at 1K and 1M", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(999)).toBe("999");
    expect(formatTokens(1000)).toBe("1.0K");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(1_000_000)).toBe("1.0M");
  });
});

describe("sortUsers", () => {
  test("sorts descending and does not mutate original array", () => {
    const users = [
      makeUser({ email: "a@x.com", tokens: 100 }),
      makeUser({ email: "b@x.com", tokens: 300 }),
      makeUser({ email: "c@x.com", tokens: 200 }),
    ];
    const original = [...users];

    const sorted = sortUsers(users, "tokens");

    expect(sorted.map((u) => u.email)).toEqual(["b@x.com", "c@x.com", "a@x.com"]);
    expect(users.map((u) => u.email)).toEqual(original.map((u) => u.email));
  });
});

describe("renderTableLines", () => {
  test("produces correct structural output", () => {
    const users = [makeUser({ email: "dev@co.com", tokens: 1500 })];
    const lines = renderTableLines(users, 30, "tokens");

    // title, double border, header, single border, data row, double border
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("Last 30 days");
    expect(lines[4]).toContain("dev@co.com");
    expect(lines[4]).toContain("1.5K");

    // empty list → 5 lines (title, border, header, separator, border)
    const empty = renderTableLines([], 7, "requests");
    expect(empty).toHaveLength(5);
  });
});
