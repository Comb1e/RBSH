// ---------------------------------------------------------------------------
// Harness: Evaluator Agent
// Judges generator output against explicit criteria.
// Keeping the evaluator separate prevents the "self-praise" failure mode.
// ---------------------------------------------------------------------------

import type { LLMProvider, AgentCompletionResult } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";
import { evaluatorToolRegistry } from "@/tools/index.js";
import { runAgent } from "./agent.js";

export async function runEvaluator(
  provider: LLMProvider,
  background: string,
  task: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: string[] //ToolAnalysisResult[]
): Promise<AgentCompletionResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EVALUATOR AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  // Evaluator needs no tools — pure LLM reasoning
  const agentMessages = await getEvaluatorPrompt(
    task,
    background,
    output,
    inputSchemaDescription,
    preCodeSummarize
  );
  const result = await runAgent(
    provider,
    agentMessages,
    evaluatorToolRegistry,
    "Evaluator"
  );
  return result;
}
