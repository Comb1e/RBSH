// ---------------------------------------------------------------------------
// Harness: Summarizer Agent
// Summarize the previous code
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getSummarizerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";

export async function runSummarizer(
  provider: LLMProvider,
  toolDescription: string,
  args: string,
  result: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  Summarizer AGENT            ║");
  console.log("╚══════════════════════════════╝\n");

  const agentMessages = await getSummarizerPrompt(
    toolDescription,
    args,
    result
  );

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(agentMessages, []);
    if (completion.content != "") {
      return completion.content;
    }
    console.log("[WARN] Summarizer returned empty content; retrying...");
  }
  return "ERROR";
}
