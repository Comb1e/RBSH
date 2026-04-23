// ---------------------------------------------------------------------------
// Harness: Generator Agent
// Executes the current step and returns a draft output.
// Context resets happen automatically because each call to query() is a
// fresh session — the handoff artifact carries state forward.
// ---------------------------------------------------------------------------

import type { HandoffArtifact, LLMProvider } from "@/types/index.js";
import { getGeneratorPrompt } from "../prompts/generator.js";
import { env } from "../config/env.js";

export async function runGenerator(
  provider: LLMProvider,
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log(
    `║  GENERATOR  (iter ${String(artifact.iterationCount).padStart(
      2
    )})        ║`
  );
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getGeneratorPrompt(
    artifact,
    background,
    inputSchemaDescription
  );

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const messages = await provider.complete(unifiedPrompt);
    if (messages.content != "") {
      return messages.content;
    }
    console.log("[WARN] Generator returned empty content; retrying...");
  }
  return "ERROR";
}
