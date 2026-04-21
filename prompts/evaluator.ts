import type { UnifiedAgentPrompt } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const evaluatorrBase = {
  skills: "evaluator.md",
};

export async function getEvaluatorPrompt(
  task: string,
  output: string,
  inputSchemas: string[]
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(evaluatorrBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemas.join("\n\n")}
  `.trim();

  const userPrompt = `
    Task: ${task}

    Output to grade:
    \`\`\`
    ${output}
    \`\`\`
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
