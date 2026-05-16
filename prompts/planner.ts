import type { AgentMessage } from "@/types/index.js";
import { resolveSkills } from "@/utils/skills.js";

const plannerBase = {
  skills: ["planner.md"],
};

export async function getPlannerPrompt(
  projectDescription: string,
  inputSchemaDescription: string,
  schemaExplanation?: string,
  needsProjectName?: boolean,
  taskType?: string | null
): Promise<AgentMessage[]> {
  const basicSkills = await resolveSkills(plannerBase.skills, taskType);

  const systemPrompt = `
  You are a principal software architect with 15+ years of experience delivering
  large-scale production systems. Your task is to produce a single, comprehensive
  project-planning document in GitHub-flavoured Markdown.

  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}
  `.trim();

  const nameInstruction = needsProjectName
    ? `
  No project name was provided. Generate a concise, descriptive kebab-case project
  name and include it in a <PROJECT_NAME>…</PROJECT_NAME> tag inside the
  <PLAN_DOCUMENT> envelope (before <MARKDOWN>).
  Example: <PROJECT_NAME>inventory-dashboard</PROJECT_NAME>
    `.trim()
    : "";

  const userPrompt = `
  Plan the following project:

  <PROJECT_DESCRIPTION>
  ${projectDescription.trim()}
  </PROJECT_DESCRIPTION>
${nameInstruction}
  Produce the full <PLAN_DOCUMENT> now.

  ${schemaExplanation ? `### Schema Explanation (from Explainer)\n${schemaExplanation}\n` : ""}
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
