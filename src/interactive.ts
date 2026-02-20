import * as readline from "readline";
import type { MergedUser } from "./identity.js";
import type { Platform } from "./fetchers/types.js";
import { sortUsers, renderTableLines, type SortKey } from "./table.js";

type FilterKey = "all" | Platform;

const FILTERS: FilterKey[] = ["all", "claude", "openai", "cursor"];
const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  claude: "Claude",
  openai: "OpenAI",
  cursor: "Cursor",
};

const DIM = "\x1b[2m";
const REVERSE = "\x1b[7m";
const RESET = "\x1b[0m";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const CLEAR_SCREEN = "\x1b[2J\x1b[H";

interface State {
  sortBy: SortKey;
  filter: FilterKey;
  allUsers: MergedUser[];
  days: number;
}

function applyFilter(users: MergedUser[], filter: FilterKey): MergedUser[] {
  if (filter === "all") return users;
  return users.filter((u) => u.platforms.has(filter));
}

function renderFilterBar(filter: FilterKey): string {
  return FILTERS.map((f) => {
    const label = ` ${FILTER_LABELS[f]} `;
    return f === filter ? `${REVERSE}[${label}]${RESET}` : `[${label}]`;
  }).join("  ");
}

function renderHintBar(): string {
  return `${DIM}  Sort: r=Requests  t=Tokens  c=Cost    Filter: Tab/1-4    q=Quit${RESET}`;
}

function render(state: State): void {
  const filtered = applyFilter(state.allUsers, state.filter);
  const sorted = sortUsers(filtered, state.sortBy);
  const tableLines = renderTableLines(sorted, state.days, state.sortBy);

  const output: string[] = [];
  output.push(CLEAR_SCREEN);
  output.push(tableLines[0]); // title
  output.push("");
  output.push("  Filter: " + renderFilterBar(state.filter));
  output.push(renderHintBar());
  output.push("");
  // table lines from double-line onward (skip title which we already printed)
  for (let i = 1; i < tableLines.length; i++) {
    output.push(tableLines[i]);
  }
  output.push("");

  process.stdout.write(output.join("\n"));
}

function cleanup(): void {
  process.stdout.write(SHOW_CURSOR + "\n");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

export function runInteractive(
  users: MergedUser[],
  days: number,
  initialSort: SortKey
): void {
  const state: State = {
    sortBy: initialSort,
    filter: "all",
    allUsers: users,
    days,
  };

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdout.write(HIDE_CURSOR);

  readline.emitKeypressEvents(process.stdin);

  render(state);

  process.stdin.on("keypress", (_str: string | undefined, key: readline.Key) => {
    if (!key) return;

    // Quit
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      cleanup();
      process.exit(0);
    }

    // Sort keys
    if (key.name === "r") {
      state.sortBy = "requests";
      render(state);
      return;
    }
    if (key.name === "t") {
      state.sortBy = "tokens";
      render(state);
      return;
    }
    if (key.name === "c") {
      state.sortBy = "cost";
      render(state);
      return;
    }

    // Filter by number
    if (key.name === "1") { state.filter = "all"; render(state); return; }
    if (key.name === "2") { state.filter = "claude"; render(state); return; }
    if (key.name === "3") { state.filter = "openai"; render(state); return; }
    if (key.name === "4") { state.filter = "cursor"; render(state); return; }

    // Tab / arrow cycle filter
    if (key.name === "tab" || key.name === "right") {
      const idx = FILTERS.indexOf(state.filter);
      state.filter = FILTERS[(idx + 1) % FILTERS.length];
      render(state);
      return;
    }
    if ((key.shift && key.name === "tab") || key.name === "left") {
      const idx = FILTERS.indexOf(state.filter);
      state.filter = FILTERS[(idx - 1 + FILTERS.length) % FILTERS.length];
      render(state);
      return;
    }
  });

  // Re-render on terminal resize
  process.stdout.on("resize", () => render(state));

  // Ensure cleanup on unexpected exit
  process.on("exit", cleanup);
}
