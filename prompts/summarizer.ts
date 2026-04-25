import type { AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const summarizerBase = {
  skills: "summarizer.md",
};

export async function getSummarizerPrompt(
  toolDescription: string,
  args: string,
  result: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(summarizerBase);
  const systemPrompt = `
You are a concise tool-use summarizer. Your sole task is to
produce a short, human-readable summary of a single agent
tool invocation.

=== BASIC SKILLS ===
${basicSkills.join("\n\n")}
    `.trim();

  const userPrompt = `
Summarize the following tool invocation.

Tool description:
${toolDescription}

Arguments passed:
${JSON.stringify(args, null, 2)}

Result returned:
${JSON.stringify(result, null, 2)}
`.trim();

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];
}
