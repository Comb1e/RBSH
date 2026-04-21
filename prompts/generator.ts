import type { UnifiedAgentPrompt, HandoffArtifact } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const generatorBase = {
  skills: "generator.md",
};

export async function getGeneratorPrompt(
  artifact: HandoffArtifact,
  inputSchemas: string[]
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(generatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === INSTRUCTIONS ===
  You will get scores for your task from 0-4, 4 is perfect.

  === Input Schemas ===
  There are excel sheets with the following columns:
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

  Key information from previous code writing:
    `.trim();
  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
