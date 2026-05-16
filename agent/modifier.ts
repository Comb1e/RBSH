// ---------------------------------------------------------------------------
// Harness: Modifier Agent
// ---------------------------------------------------------------------------

import type { LLMProvider, AgentCompletionResult } from "@/types/index.js";
import { getModifierBaseMessage } from "@/prompts/index.js";
import { runAgent } from "./agent.js";
import { modifierToolRegistry } from "@/tools/index.js";

export async function runModifier(
  provider: LLMProvider,
  modificationRequest: string,
  existingPlanLocation: string,
  projectDir?: string,
  taskType?: string | null
): Promise<AgentCompletionResult> {
  console.log(`\n[MODIFIER]`);

  let agentMessages = await getModifierBaseMessage(
    modificationRequest,
    existingPlanLocation,
    projectDir,
    taskType
  );
  const result = await runAgent(
    provider,
    agentMessages,
    modifierToolRegistry,
    "Modifier",
    projectDir
  );
  return result;
}
