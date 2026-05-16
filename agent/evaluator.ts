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
import * as path from "node:path";

export async function runEvaluator(
  provider: LLMProvider,
  background: string,
  task: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: ToolAnalysisResult[],
  currentToolSummarization?: ToolAnalysisResult[],
  outputDir?: string,
  taskType?: string | null
): Promise<AgentCompletionResult> {
  console.log(`\n[EVALUATOR]`);

  const projectName = outputDir ? path.basename(outputDir) : undefined;

  const agentMessages = await getEvaluatorPrompt(
    task,
    background,
    output,
    inputSchemaDescription,
    preCodeSummarize,
    currentToolSummarization,
    projectName,
    taskType
  );
  const result = await runAgent(
    provider,
    agentMessages,
    evaluatorToolRegistry,
    "Evaluator",
    outputDir
  );
  return result;
}
