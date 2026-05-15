// ---------------------------------------------------------------------------
// Harness: Planner Agent
// Decomposes the user task into a structured step list.
// ---------------------------------------------------------------------------

import type { LLMProvider, ParsedPlan } from "@/types/index.js";
import { getPlannerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";
import { plannerParseResponse, writePlanFile } from "@/utils/index.js";

export async function runPlanner(
  provider: LLMProvider,
  background: string,
  inputSchemaDescription: string,
  projectDir: string,
  schemaExplanation?: string
): Promise<{ planPath: string; projectDir: string }> {
  console.log(`\n[PLANNER]`);

  const unifiedPrompt = await getPlannerPrompt(
    background,
    inputSchemaDescription,
    schemaExplanation
  );

  let raw = "";
  for (let iter = 1; iter <= env.PLANNER_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(unifiedPrompt, {});
    if (completion.content != "") {
      raw = completion.content;
      break;
    }
    console.log("[WARN] Planner returned empty content; retrying...");
  }
  if (raw == "") {
    console.warn(
      "[ERROR] Planner failed to return any content; falling back to single-step plan."
    );
    return { planPath: "", projectDir: "" };
  }

  try {
    const plan: ParsedPlan = plannerParseResponse(raw);
    const planPath = writePlanFile("plan.md", plan.markdown, projectDir);
    return { planPath, projectDir };
  } catch {
    console.warn(
      "Planner validation failed — response did not match required plan format."
    );
    return { planPath: "", projectDir: "" };
  }
}
