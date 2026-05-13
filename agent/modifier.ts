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
  existingPlanLocation: string
): Promise<AgentCompletionResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  Modifier AGENT              ║");
  console.log("╚══════════════════════════════╝\n");

  let agentMessages = await getModifierBaseMessage(
    modificationRequest,
    existingPlanLocation
  );
  const result = await runAgent(
    provider,
    agentMessages,
    modifierToolRegistry,
    "Modifier"
  );
  return result;
}
