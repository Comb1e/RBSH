// ---------------------------------------------------------------------------
// Harness: Planner Agent
// Decomposes the user task into a structured step list.
// ---------------------------------------------------------------------------

import type { LLMProvider, ParsedPlan } from "@/types/index.js";
import { getPlannerPrompt } from "@/prompts/index.js";
import { env } from "../config/env.js";
import { plannerParseResponse, writePlanFile } from "@/utils/index.js";
import { stripProjectNameTag } from "@/utils/output.js";
import {
  checkForInterrupt,
  enableInterruptCapture,
  disableInterruptCapture,
} from "@/utils/input.js";

export async function runPlanner(
  provider: LLMProvider,
  background: string,
  inputSchemaDescription: string,
  projectDir: string,
  schemaExplanation?: string,
  taskType?: string | null
): Promise<{ planPath: string; projectDir: string }> {
  const needsProjectName = !projectDir;

  console.log(`\n[PLANNER]${needsProjectName ? " (generating project name)" : ""}`);

  const unifiedPrompt = await getPlannerPrompt(
    background,
    inputSchemaDescription,
    schemaExplanation,
    needsProjectName,
    taskType
  );

  let raw = "";
  enableInterruptCapture();
  try {
    for (let iter = 1; iter <= env.PLANNER_MAX_ITERATIONS; iter++) {
      const interrupt = await checkForInterrupt();
      if (interrupt.aborted) {
        console.log("[INFO] Planner interrupted by user.");
        return { planPath: "", projectDir: "" };
      }
      if (interrupt.feedback) {
        unifiedPrompt.push({ role: "user", content: interrupt.feedback });
      }

      const completion = await provider.complete(unifiedPrompt, {});
      if (completion.content != "") {
        raw = completion.content;
        break;
      }
      console.log("[WARN] Planner returned empty content; retrying...");
    }
  } finally {
    disableInterruptCapture();
  }
  if (raw == "") {
    console.warn(
      "[ERROR] Planner failed to return any content; falling back to single-step plan."
    );
    return { planPath: "", projectDir: "" };
  }

  try {
    const plan: ParsedPlan = plannerParseResponse(raw);
    let markdown = plan.markdown;
    let resolvedDir = projectDir;

    if (needsProjectName) {
      const name = plan.projectName || "untitled";
      resolvedDir = `./output/${name}`;
      markdown = stripProjectNameTag(markdown);
      console.log(`[INFO] Planner generated project name: ${name}`);
    }

    const planPath = writePlanFile("plan.md", markdown, resolvedDir);
    return { planPath, projectDir: resolvedDir };
  } catch {
    console.warn(
      "Planner validation failed — response did not match required plan format."
    );
    return { planPath: "", projectDir: "" };
  }
}
