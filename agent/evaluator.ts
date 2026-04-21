// ---------------------------------------------------------------------------
// Harness: Evaluator Agent
// Judges generator output against explicit criteria.
// Keeping the evaluator separate prevents the "self-praise" failure mode.
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";

export async function runEvaluator(
  provider: LLMProvider,
  task: string,
  output: string,
  inputSchemas: string[]
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EVALUATOR AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  // Evaluator needs no tools — pure LLM reasoning
  const unifiedPrompt = await getEvaluatorPrompt(task, output, inputSchemas);
  const unifiedMessages = await provider.complete(unifiedPrompt);
  const raw = unifiedMessages.content;

  return raw;
}
