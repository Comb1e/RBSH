import type { UnifiedAgentPrompt } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const summarizerBase = {
  skills: "summarizer.md",
};

export async function getSummarizerPrompt(
  code: string,
  path: string
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(summarizerBase);
  const systemPrompt = `
You are a senior software engineer and code analysis expert.
Your task is to analyze a multi-file codebase and extract structured, machine-readable information for each file independently.

=== BASIC SKILLS ===
${basicSkills.join("\n\n")}
    `.trim();

  const userPrompt = `
Input code:
${code}
Relative file path:
${path}
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
