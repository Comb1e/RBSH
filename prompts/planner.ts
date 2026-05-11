import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const plannerBase = {
  skills: ["planner.md"],
};

export async function getPlannerPrompt(
  projectDescription: string,
  inputSchemaDescription: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(plannerBase);

  const systemPrompt = `
  You are a principal software architect with 15+ years of experience delivering
  large-scale production systems. Your task is to produce a single, comprehensive
  project-planning document in GitHub-flavoured Markdown.

  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}
  `.trim();
  const userPrompt = `
  Plan the following project:

  <PROJECT_DESCRIPTION>
  ${projectDescription.trim()}
  </PROJECT_DESCRIPTION>

  Produce the full <PLAN_DOCUMENT> now.

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
