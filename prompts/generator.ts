import type { UnifiedAgentPrompt, HandoffArtifact } from "@/types/index.js";
import { readFilesFromRecord, readFilesFromList } from "@/utils/get_params.js";

const generatorBase = {
  skills: "generator.md",
};

export async function getGeneratorPrompt(
  artifact: HandoffArtifact,
  inputSchemas: string[]
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(generatorBase);
  const systemPrompt = `
  You are continuing a multi-session task. Generate code or articles to solve the task.
  === INSTRUCTIONS ===
  Complete the next step. Output ONLY the result of that step — no preamble.
  You will get scores for your task from 0-10, 10 is perfect.

  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === Input Schemas ===
  ${inputSchemas.join("\n\n")}
    `.trim();

  const userPrompt = `
  Task: ${artifact.task}

  Completed steps:
  ${
    Object.entries(artifact.completedSteps)
      .map(([key, value], i) => `  ${i + 1}. ${key}: ${value}`)
      .join("\n") || "  (none yet)"
  }

  Next step to execute:
    ${artifact.remainingSteps[0] ?? "(all steps complete)"}

  Previous output to build on:
  ${artifact.currentOutput || "(no prior output)"}

  Max score output:
    `.trim();

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
