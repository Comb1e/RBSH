import type { HandoffArtifact, AgentMessage } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { readFilesFromRecord } from "@/utils/get_params.js";

const generatorBase = {
  skills: ["generator.md", "user_preferences.md"],
};

function renderPriorContext(summaries: ToolAnalysisResult[]): string {
  if (!summaries.length) return "(no prior code — first iteration)";

  const files: string[] = [];
  for (const s of summaries) {
    if (s.files) {
      for (const f of s.files) {
        files.push(`- \`${f.path}\` — ${f.summary}`);
      }
    }
    if (s.code_summary) {
      for (const f of s.code_summary) {
        const fp = f.file.relative_path || f.file.file_name;
        files.push(`- \`${fp}\` — ${f.file.summary || s.purpose || ""}`);
      }
    }
  }

  return files.length > 0
    ? `Files from completed steps (use readFile to inspect before importing):\n${files.join("\n")}`
    : `Completed steps: ${summaries.map((s) => s.purpose).filter(Boolean).join("; ") || "(no details)"}`;
}

export async function createGeneratorBaseMessage(
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string,
  evaluationStr: string,
  plan?: string,
  outputDir?: string
): Promise<AgentMessage[]> {
  const basicSkills = await readFilesFromRecord(generatorBase);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === INSTRUCTIONS ===
  You will get scores for your task from 0-4, 4 is perfect.
  Notice the output format!!!

  === OUTPUT DIRECTORY ===
  Write ALL files to this directory: ${outputDir || "./output"}
  Every file path you pass to createFileWithDirectories MUST start with this
  directory. Do not write files anywhere else.

  === BACKGROUND ===
  ${background}

  === Input Schemas ===
  There are excel sheets with the following columns:
  ${inputSchemaDescription}

  === PROJECT PLAN ===
  ${plan || "(no plan provided)"}
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
  ${renderPriorContext(artifact.preToolSummarize)}

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
