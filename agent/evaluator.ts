// ---------------------------------------------------------------------------
// Harness: Evaluator Agent
// Judges generator output against explicit criteria.
// Keeping the evaluator separate prevents the "self-praise" failure mode.
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import type { CodeAnalysisResult } from "@/schemas/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";

export async function runEvaluator(
  provider: LLMProvider,
  background: string,
  task: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: CodeAnalysisResult[]
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EVALUATOR AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  // Evaluator needs no tools — pure LLM reasoning
  const unifiedPrompt = await getEvaluatorPrompt(
    task,
    background,
    output,
    inputSchemaDescription,
    preCodeSummarize
  );
  const unifiedMessages = await provider.complete(unifiedPrompt);
  const raw = unifiedMessages.content;

  return raw;
}
