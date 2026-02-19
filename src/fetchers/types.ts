export type Platform = "claude" | "openai" | "cursor";

export interface NormalizedRecord {
  email: string;
  platform: Platform;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}
