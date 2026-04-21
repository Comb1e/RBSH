import type { UnifiedAgentPrompt } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const plannerBase = {
  skills: "planner.md",
};

export async function getPlannerPrompt(
  task: string,
  inputSchemas: string[]
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(plannerBase);

  const systemPrompt = `
    You are a planning agent. Break the following task into concrete, sequential sub-tasks. For simple ones, 2-4 is perfect; for complex ones, more may be needed. Be specific and actionable — avoid vague or high-level steps.
    Return ONLY a JSON array of strings — no prose, no markdown fences.
    Must mark file name in each step.

    === BASIC SKILLS ===
    ${basicSkills.join("\n\n")}

    === Input Schemas ===
    There are excel sheets with the following columns:
    ${inputSchemas.join("\n\n")}
  `.trim();
  const userPrompt = `
    Task: ${task}
    `.trim();
  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
