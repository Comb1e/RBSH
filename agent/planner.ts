// ---------------------------------------------------------------------------
// Harness: Planner Agent
// Decomposes the user task into a structured step list.
// ---------------------------------------------------------------------------

import type { LLMProvider, LLMCompletionResult } from "@/types/index.js";
import { getPlannerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";

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
  let messages: LLMCompletionResult = { content: "" };
  let raw = "";
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    messages = await provider.complete(unifiedPrompt);
    if (messages.content != "") {
      raw = messages.content;
    }
    console.log("[WARN] Planner returned empty content; retrying...");
  }
  if (raw == "") {
    console.warn(
      "[ERROR] Planner failed to return any content; falling back to single-step plan."
    );
    return [background];
  }

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
