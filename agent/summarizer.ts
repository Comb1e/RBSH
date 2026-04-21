// ---------------------------------------------------------------------------
// Harness: Summarizer Agent
// Summarize the previous code
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getSummarizerPrompt } from "@/prompts/index.js";

export async function runSummarizer(
  provider: LLMProvider,
  code: string,
  path: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  Summarizer AGENT               ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getSummarizerPrompt(code, path);

  const messages = await provider.complete(unifiedPrompt);
  return messages.content;
}
