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
  evaluationStr: string
): Promise<AgentCompletionResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log(
    `║  GENERATOR  (iter ${String(artifact.iterationCount).padStart(
      2
    )})        ║`
  );
  console.log("╚══════════════════════════════╝\n");

  let agentMessages = await createGeneratorBaseMessage(
    artifact,
    background,
    inputSchemaDescription,
    evaluationStr
  );
  const result = await runAgent(
    provider,
    agentMessages,
    generatorToolRegistry,
    "Generator"
  );
  return result;
}
