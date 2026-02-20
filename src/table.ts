import type { MergedUser } from "./identity.js";
import { platformDisplayName } from "./identity.js";
import type { Platform } from "./fetchers/types.js";

export type SortKey = "requests" | "tokens" | "cost";

export function sortUsers(users: MergedUser[], sortBy: SortKey): MergedUser[] {
  const key = sortBy === "cost" ? "costCents" : sortBy;
  return [...users].sort((a, b) => b[key] - a[key]);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatCost(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  if (align === "right") return s.padStart(width);
  return s.padEnd(width);
}

interface RowData {
  rank: string;
  email: string;
  requests: string;
  tokens: string;
  cost: string;
  tools: string;
  subRows?: { platform: string; requests: string; tokens: string; cost: string }[];
}

export function printTable(users: MergedUser[], days: number, sortBy: SortKey): void {
  const title = `AI Coding Usage Leaderboard (Last ${days} days)`;

  // Prepare row data
  const rows: RowData[] = users.map((u, i) => {
    const subRows = u.byPlatform.size > 1
      ? Array.from(u.byPlatform.entries()).map(([p, usage]) => ({
          platform: platformDisplayName(p),
          requests: String(usage.requests),
          tokens: formatTokens(usage.tokens),
          cost: formatCost(usage.costCents),
        }))
      : undefined;

    return {
      rank: String(i + 1),
      email: u.email,
      requests: String(u.requests),
      tokens: formatTokens(u.tokens),
      cost: formatCost(u.costCents),
      tools: Array.from(u.platforms)
        .map((p) => platformDisplayName(p as Platform))
        .join(", "),
      subRows,
    };
  });

  // Column widths
  const cols = {
    rank: Math.max(2, ...rows.map((r) => r.rank.length)),
    email: Math.max(4, ...rows.map((r) => r.email.length)),
    requests: Math.max(8, ...rows.map((r) => r.requests.length)),
    tokens: Math.max(6, ...rows.map((r) => r.tokens.length)),
    cost: Math.max(6, ...rows.map((r) => r.cost.length)),
    tools: Math.max(5, ...rows.map((r) => r.tools.length)),
  };

  const totalWidth =
    cols.rank + cols.email + cols.requests + cols.tokens + cols.cost + cols.tools + 15; // spacing

  const header = [
    pad("#", cols.rank, "right"),
    pad("User", cols.email),
    pad("Requests", cols.requests, "right"),
    pad("Tokens", cols.tokens, "right"),
    pad("Cost", cols.cost, "right"),
    pad("Tools", cols.tools),
  ].join("   ");

  const doubleLine = "\u2550".repeat(totalWidth);
  const singleLine = "\u2500".repeat(totalWidth);

  console.log();
  console.log(title);
  console.log(doubleLine);
  console.log(" " + header);
  console.log(singleLine);

  for (const row of rows) {
    const line = [
      pad(row.rank, cols.rank, "right"),
      pad(row.email, cols.email),
      pad(row.requests, cols.requests, "right"),
      pad(row.tokens, cols.tokens, "right"),
      pad(row.cost, cols.cost, "right"),
      pad(row.tools, cols.tools),
    ].join("   ");
    console.log(" " + line);

    if (row.subRows) {
      for (const sub of row.subRows) {
        const subLine = [
          pad("", cols.rank),
          pad("  " + sub.platform, cols.email),
          pad(sub.requests, cols.requests, "right"),
          pad(sub.tokens, cols.tokens, "right"),
          pad(sub.cost, cols.cost, "right"),
          pad("", cols.tools),
        ].join("   ");
        console.log(" " + subLine);
      }
    }
  }

  console.log(doubleLine);
  console.log();
}
