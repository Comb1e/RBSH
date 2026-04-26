import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const comprehensionBase = {
  skills: ["comprehension.md"],
};

export async function getComprehensionPrompt(
  user_prompt: string,
  inputSchemas: string[]
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(comprehensionBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemas.join("\n\n")}
  `.trim();

  const userPrompt = `
    user_prompt: ${user_prompt}

    `.trim();

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    { role: "user", content: userPrompt },
  ];
}
