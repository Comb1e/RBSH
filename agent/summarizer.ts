// ---------------------------------------------------------------------------
// Harness: Summarizer Agent
// Summarize the previous code
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getSummarizerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";

export async function runSummarizer(
  provider: LLMProvider,
  code: string,
  path: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  Summarizer AGENT               ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getSummarizerPrompt(code, path);

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const messages = await provider.complete(unifiedPrompt);
    if (messages.content != "") {
      return messages.content;
    }
    console.log("[WARN] Summarizer returned empty content; retrying...");
  }
  return "ERROR";
}
