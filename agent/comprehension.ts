// ---------------------------------------------------------------------------
// Harness: Comprehension Agent
// Comprehend the task and explain the input
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getComprehensionPrompt } from "../prompts/comprehension.js";

export async function runComprehension(
  provider: LLMProvider,
  user_prompt: string,
  inputSchemas: string[]
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  COMPREHENSION AGENT           ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getComprehensionPrompt(user_prompt, inputSchemas);

  const messages = await provider.complete(unifiedPrompt);
  return messages.content;
}
