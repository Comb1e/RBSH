import type { AgentMessage } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const evaluatorBase = {
  skills: ["evaluator.md"],
};

export async function getEvaluatorPrompt(
  task: string,
  background: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: ToolAnalysisResult[]
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(evaluatorBase);
  const systemPrompt = `
  Do not use tools. Only evaluate.

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
  console.log(userPrompt);
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    { role: "user", content: userPrompt },
  ];
}
