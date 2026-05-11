// ---------------------------------------------------------------------------
// Harness: Planner Agent
// Decomposes the user task into a structured step list.
// ---------------------------------------------------------------------------

import type { LLMProvider, ParsedPlan } from "@/types/index.js";
import { getPlannerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";
import { plannerParseResponse, writePlanFile } from "@/utils/index.js";

const PLAN_OUTPUT_DIR = "./output/plan";

export async function runPlanner(
  provider: LLMProvider,
  background: string,
  inputSchemaDescription: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  PLANNER AGENT               ║");
  console.log("╚══════════════════════════════╝\n");

  const unifiedPrompt = await getPlannerPrompt(
    background,
    inputSchemaDescription
  );

  // Planner needs no file-system tools — disable them all for minimum footprint
  let raw = "";
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
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
    return "";
  }

  try {
    const plan: ParsedPlan = plannerParseResponse(raw);
    const planFilePath: string = writePlanFile(
      plan.filename,
      plan.markdown,
      PLAN_OUTPUT_DIR
    );
    return planFilePath;
  } catch {
    console.warn(
      "Planner returned non-JSON; falling back to single-step plan."
    );
    return "";
  }
}
