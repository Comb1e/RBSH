// ---------------------------------------------------------------------------
// Harness: Evaluator Agent
// Judges generator output against explicit criteria.
// Keeping the evaluator separate prevents the "self-praise" failure mode.
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";

export async function runEvaluator(
  provider: LLMProvider,
  background: string,
  task: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: ToolAnalysisResult[]
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
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(unifiedPrompt, []);
    const content = completion.content;
    if (content == "") {
      console.log("[WARN] Evaluator returned empty content; retrying...");
      continue;
    }
    return content;
  }
  return "ERROR";
}
