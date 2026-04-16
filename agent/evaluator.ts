// ---------------------------------------------------------------------------
// Harness: Evaluator Agent
// Judges generator output against explicit criteria.
// Keeping the evaluator separate prevents the "self-praise" failure mode.
// ---------------------------------------------------------------------------

import type { EvaluationResult, LLMProvider } from "@/types/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";

export async function runEvaluator(
  provider: LLMProvider,
  task: string,
  output: string,
  inputSchemas: string[]
): Promise<EvaluationResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EVALUATOR AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  // Evaluator needs no tools — pure LLM reasoning
  const unifiedPrompt = getEvaluatorPrompt(task, output, inputSchemas);
  const unifiedMessages = await provider.complete(unifiedPrompt);
  const raw = unifiedMessages.content;

  try {
    const result: EvaluationResult = JSON.parse(raw);
    // Enforce the passing threshold in the harness, not the LLM
    result.passed = result.score >= env.PASSING_THRESHOLD;
    return result;
  } catch {
    return {
      score: 0,
      passed: false,
      critique: "Evaluator returned malformed JSON.",
      suggestedRevision: "Re-attempt generation.",
    };
  }
}
