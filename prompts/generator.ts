import type { HandoffArtifact, AgentMessage } from "@/types/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const generatorBase = {
  skills: ["generator.md"],
};

export async function createGeneratorBaseMessage(
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string,
  evaluationStr: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(generatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === INSTRUCTIONS ===
  You will get scores for your task from 0-4, 4 is perfect.
  Notice the output format!!!

  === BACKGROUND ===
  ${background}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemaDescription}
    `.trim();

  const userPrompt = `
  TASK
  ────
  ${artifact.task}

  ✅ COMPLETED STEPS (DO NOT re-implement these — already done)
  ─────────────────────────────────────────────────────────────
  These steps have been fully executed. Their outputs are captured
  in "Code Summarization" and "Previous Output" below.
  ${
    Object.entries(artifact.completedSteps).length > 0
      ? Object.entries(artifact.completedSteps)
          .map(
            ([key, value], i) =>
              `  [DONE] ${i + 1}. ${key}\n         Output: ${value}`
          )
          .join("\n")
      : "  (none yet — this is the first iteration)"
  }

  ⏳ REMAINING STEPS (YOUR FOCUS — implement these next)
  ──────────────────────────────────────────────────────
  These steps are pending. Continue from where the previous
  iteration left off. Do NOT repeat completed steps above.
  ${
    artifact.remainingSteps.length > 0
      ? artifact.remainingSteps
          .map((s, i) => `  [TODO] ${i + 1}. ${s}`)
          .join("\n")
      : "  (none — all steps are complete)"
  }

  ───────────────────────────────────────────────────────
  SUMMARIZATION OF COMPLETED STEPS
  (Use this directly — do not rewrite what already exists)
  ───────────────────────────────────────────────────────
  ${
    JSON.stringify(artifact.preToolSummarize) ||
    "(no prior code — first iteration)"
  }

  ───────────────────────────────────────────────────────
  KEY INFORMATION FROM PREVIOUS CODE WRITING
  ───────────────────────────────────────────────────────
  ${evaluationStr || "(none)"}
  `.trim();
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
