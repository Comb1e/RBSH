import type { AgentMessage } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const evaluatorBase = {
  skills: ["evaluator.md", "user_preferences.md"],
};

export async function getEvaluatorPrompt(
  task: string,
  background: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: ToolAnalysisResult[] //ToolAnalysisResult[]
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(evaluatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === MANDATORY VERIFICATION ===
  If the generator's output mentions ANY files (created, modified, or referenced),
  you MUST call readFile on EVERY claimed file before scoring. The generator's
  claims are not evidence — only the file contents on disk are authoritative.
  Scoring without reading files when files are claimed is an automatic protocol
  violation and will cause the pipeline to accept broken output.

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
  The generator claims to have produced the following:
  \`\`\`
  ${output}
  \`\`\`

  Verify every file claim with readFile before scoring.

  ## Prior Context (Completed Steps)
  ${
    preCodeSummarize.length > 0
      ? `The following is a summary of code or content produced in earlier steps:\n${JSON.stringify(preCodeSummarize, null, 2)}`
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
