// ---------------------------------------------------------------------------
// Harness: Planner Agent
// Decomposes the user task into a structured step list.
// ---------------------------------------------------------------------------

import type { LLMProvider } from "@/types/index.js";
import { getPlannerPrompt } from "@/prompts/index.js";

export async function runPlanner(
  provider: LLMProvider,
  background: string,
  inputSchemaDescription: string
): Promise<string[]> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  PLANNER AGENT               ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getPlannerPrompt(
    background,
    inputSchemaDescription
  );

  // Planner needs no file-system tools — disable them all for minimum footprint
  const messages = await provider.complete(unifiedPrompt);
  const raw = messages.content;

  try {
    const steps: string[] = JSON.parse(raw);
    console.log("\nPlan:\n", steps.map((s, i) => `${i + 1}. ${s}`).join("\n"));
    return steps;
  } catch {
    console.warn(
      "Planner returned non-JSON; falling back to single-step plan."
    );
    return [background];
  }
}
