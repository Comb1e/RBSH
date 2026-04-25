import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const plannerBase = {
  skills: "planner.md",
};

export async function getPlannerPrompt(
  background: string,
  inputSchemaDescription: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(plannerBase);

  const systemPrompt = `
    You are a planning agent. Break the following task into concrete, sequential sub-tasks. For simple ones, 2-4 is perfect; for complex ones, more may be needed. Be specific and actionable — avoid vague or high-level steps.
    Return ONLY a JSON array of strings — no prose, no markdown fences.
    Must mark file name in each step.
    Remember: .cpp and .h file for one single name should be generated in one step, not split across two steps.

    === BASIC SKILLS ===
    ${basicSkills.join("\n\n")}
  `.trim();
  const userPrompt = `
    Task: ${background}

    Input Schema: ${inputSchemaDescription}
    `.trim();
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    { role: "user", content: userPrompt },
  ];
}
