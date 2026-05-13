import { runModifier, runPlanner } from "@/agent/index.js";
import {
  input,
  rl,
  getUserPromptByCommand,
  checkCommond,
  parseAddCommand,
} from "@/utils/index.js";
import { LLMProvider, PlanResult } from "@/types/index.js";

export async function plan(
  provider: LLMProvider,
  inputSchemasString: string
): Promise<PlanResult> {
  console.log("[INFO] Starting plan...");
  let planPath: string = "";
  while (true) {
    const command = await input("> ");
    const workType = checkCommond(command);
    const planResult: PlanResult = {
      planPath: planPath,
      worktype: workType,
      addFiles: workType === "add" ? parseAddCommand(command) : undefined,
    };

    if (workType != "") {
      return planResult;
    }

    const userPrompt: string = await getUserPromptByCommand(command);

    if (planPath === "") {
      console.log("[INFO] user prompt: ", userPrompt);
      console.log("[INFO] Starting planner...");
      planPath = await runPlanner(provider, userPrompt, inputSchemasString);
    } else {
      console.log("[INFO] Starting modifier...");
      await runModifier(provider, userPrompt, planPath);
    }
  }
}
