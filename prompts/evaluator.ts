import type { UnifiedAgentPrompt } from "@/types/index.js";
import type { CodeAnalysisResult } from "@/schemas/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const evaluatorBase = {
  skills: "evaluator.md",
};

export async function getEvaluatorPrompt(
  task: string,
  background: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: CodeAnalysisResult[]
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(evaluatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === Background ===
  ${background}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemaDescription}
  `.trim();

  const userPrompt = `
    Task: ${task}

    Output to grade:
    \`\`\`
    ${output}
    \`\`\`

    Code summarization for completed steps:
    ${preCodeSummarize}
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
