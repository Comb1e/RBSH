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
  preCodeSummarize: string[] //ToolAnalysisResult[]
): Promise<AgentMessage[]> {
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
  ## Task Description
  The following task was assigned to another agent:
  ${task}

  ## Output to Evaluate
  The agent produced the following output:
  \`\`\`
  ${output}
  \`\`\`

  ## Prior Context (Completed Steps)
  ${
    preCodeSummarize.length > 0
      ? `The following is a summary of code or content produced in earlier steps:\n${preCodeSummarize}`
      : "No prior steps were completed before this tool use."
  }
  `.trim();
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    { role: "user", content: userPrompt },
  ];
}
