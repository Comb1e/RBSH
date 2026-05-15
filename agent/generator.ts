// ---------------------------------------------------------------------------
// Harness: Generator Agent
// Executes the current step and returns a draft output.
// Context resets happen automatically because each call to query() is a
// fresh session — the handoff artifact carries state forward.
// ---------------------------------------------------------------------------

import type {
  HandoffArtifact,
  LLMProvider,
  AgentCompletionResult,
} from "@/types/index.js";
import { createGeneratorBaseMessage } from "../prompts/generator.js";
import { runAgent } from "./agent.js";
import { generatorToolRegistry } from "@/tools/index.js";

export async function runGenerator(
  provider: LLMProvider,
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string,
  evaluationStr: string,
  plan: string,
  outputDir?: string
): Promise<AgentCompletionResult> {
  console.log(`\n[GENERATOR] Iteration ${String(artifact.iterationCount).padStart(2)}`);

  let agentMessages = await createGeneratorBaseMessage(
    artifact,
    background,
    inputSchemaDescription,
    evaluationStr,
    plan,
    outputDir
  );
  const result = await runAgent(
    provider,
    agentMessages,
    generatorToolRegistry,
    "Generator",
    outputDir
  );
  return result;
}
