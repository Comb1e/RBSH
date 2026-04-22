import type { UnifiedAgentPrompt, HandoffArtifact } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const generatorBase = {
  skills: "generator.md",
};

export async function getGeneratorPrompt(
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string
): Promise<UnifiedAgentPrompt> {
  const basicSkills = await readFilesFromRecord(generatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === INSTRUCTIONS ===
  You will get scores for your task from 0-4, 4 is perfect.

  === BACKGROUND ===
  ${background}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemaDescription}
    `.trim();

  const userPrompt = `
  Task: ${artifact.task}

  Completed steps:
  ${
    Object.entries(artifact.completedSteps)
      .map(([key, value], i) => `  ${i + 1}. ${key}: ${value}`)
      .join("\n") || "  (none yet)"
  }

  Code summarization for completed steps, you can directly use this to avoid writing code that has already been written:
  ${artifact.preCodeSummarize}

  Previous output to build on:
  ${artifact.currentOutput || "(no prior output)"}

  Key information from previous code writing:
    `.trim();
  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
