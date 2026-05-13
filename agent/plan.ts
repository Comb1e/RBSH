import { runModifier, runPlanner } from "@/agent/index.js";
import {
  input,
  rl,
  getUserPromptByCommand,
  checkCommand,
  parseAddCommand,
} from "@/utils/index.js";
import { LLMProvider, PlanResult } from "@/types/index.js";

export async function plan(
  provider: LLMProvider,
  inputSchemasString: string,
  initialWorkType?: string,
  initialModifyTarget?: string
): Promise<PlanResult> {
  console.log("[INFO] Starting plan...");
  let planPath: string = "";
  let projectDir: string = "";
  let modifyTarget: string = initialModifyTarget || "";
  let workType: string = initialWorkType || "plan";

  while (true) {
    if (workType === "modify") {
      const command = await input("modify> ");
      const cmd = checkCommand(command);
      if (cmd !== "" && cmd !== "modify") {
        if (cmd === "new") {
          planPath = "";
          projectDir = "";
          modifyTarget = "";
          workType = "plan";
          continue;
        }
        return {
          planPath,
          projectDir,
          worktype: cmd,
          addFiles: cmd === "add" ? parseAddCommand(command) : undefined,
        };
      }
      const target = modifyTarget || planPath;
      console.log(`[INFO] Modifying: ${target}`);
      await runModifier(provider, command, target);
      continue;
    }

    const command = await input("plan> ");
    const cmd = checkCommand(command);

    if (cmd === "quit" || cmd === "execute" || cmd === "explain") {
      return { planPath, projectDir, worktype: cmd };
    }
    if (cmd === "add") {
      return {
        planPath,
        projectDir,
        worktype: "add",
        addFiles: parseAddCommand(command),
      };
    }

    const userPrompt: string = await getUserPromptByCommand(command);
    console.log("[INFO] user prompt: ", userPrompt);
    console.log("[INFO] Starting planner...");

    const result = await runPlanner(provider, userPrompt, inputSchemasString);
    if (result.planPath) {
      planPath = result.planPath;
      projectDir = result.projectDir;
      modifyTarget = planPath; // after plan, modify plan.md
      console.log(`[INFO] Plan created: ${planPath}`);
      workType = "modify";
    } else {
      console.warn("[WARN] Plan generation failed — see planner output above. Please try again.");
    }
  }
}
