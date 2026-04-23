// ---------------------------------------------------------------------------
// Harness: Comprehension Agent
// Comprehend the task and explain the input
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getComprehensionPrompt } from "../prompts/comprehension.js";
import { env } from "../config/env.js";

export async function runComprehension(
  provider: LLMProvider,
  user_prompt: string,
  inputSchemas: string[]
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  COMPREHENSION AGENT         ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getComprehensionPrompt(user_prompt, inputSchemas);

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const messages = await provider.complete(unifiedPrompt);
    if (messages.content != "") {
      return messages.content;
    }
    console.log("[WARN] Evaluator returned empty content; retrying...");
  }
  return "ERROR";
}
