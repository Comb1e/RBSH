import type { AgentMessage } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { resolveSkills } from "@/utils/skills.js";

const evaluatorBase = ["evaluator.md"];

function buildFileChecklist(summaries?: ToolAnalysisResult[]): string {
  if (!summaries || summaries.length === 0) return "";

  const files: { path: string; purpose: string }[] = [];
  for (const s of summaries) {
    if (s.files) {
      for (const f of s.files) {
        if (f.path && !files.some((x) => x.path === f.path)) {
          files.push({ path: f.path, purpose: f.summary || s.purpose || "" });
        }
      }
    }
    if (s.code_summary) {
      for (const f of s.code_summary) {
        const filePath = f.file.relative_path;
        if (filePath && !files.some((x) => x.path === filePath)) {
          files.push({ path: filePath, purpose: s.purpose || "" });
        }
      }
    }
  }

  if (files.length === 0) return "";

  const lines = [
    "## Files to Verify",
    "The generator's tool invocations reference these files. You MUST call",
    "`readFile` on EVERY file listed below before scoring. If a file does not",
    "exist at the exact path shown, that is a Critical Failure.",
    "",
    ...files.map((f) => `- \`${f.path}\` — ${f.purpose}`),
    "",
  ];
  return lines.join("\n");
}

export async function getEvaluatorPrompt(
  task: string,
  background: string,
  output: string,
  inputSchemaDescription: string,
  preCodeSummarize: ToolAnalysisResult[],
  currentToolSummarization?: ToolAnalysisResult[],
  projectName?: string,
  taskType?: string | null
): Promise<AgentMessage[]> {
  const basicSkills = await resolveSkills(evaluatorBase, taskType);
  const fileChecklist = buildFileChecklist(currentToolSummarization);

  const systemPrompt = `
=== BASIC SKILLS ===
${basicSkills.join("\n\n")}

=== OUTPUT DIRECTORY ===
All generated files live under the project directory${projectName ? ` ("${projectName}")` : ""}.
Every path in "## Files to Verify" is relative to this directory.
Use the exact paths shown — do not strip or alter them.

=== Background ===
${background}

=== Input Schemas ===
${inputSchemaDescription}
`.trim();

  const userPrompt = `
## Task Description
${task}

${fileChecklist}
## Output to Evaluate
The generator produced the following output:
\`\`\`
${output}
\`\`\`

## Prior Context (Completed Steps)
${
  preCodeSummarize.length > 0
    ? `Summary of code or content produced in earlier steps:\n${JSON.stringify(preCodeSummarize, null, 2)}`
    : "No prior steps were completed before this tool use."
}
`.trim();

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
