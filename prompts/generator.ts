import type { HandoffArtifact, AgentMessage } from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { resolveSkills } from "@/utils/skills.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const generatorBase = [
  "generator.md",
  "coding.md",
  "execute_command.md",
  "user_preferences.md",
];

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
    ? `Files from completed steps (use readFile to inspect before importing):\n${files.join(
        "\n"
      )}`
    : `Completed steps: ${
        summaries
          .map((s) => s.purpose)
          .filter(Boolean)
          .join("; ") || "(no details)"
      }`;
}

async function buildInputFilesSection(outputDir?: string): Promise<string> {
  const header = "=== INPUT FILES (already in input_data/) ===";
  if (!outputDir)
    return `${header}\n(no project directory — input files unavailable)`;

  const inputDir = path.join(outputDir, "input_data");
  try {
    const entries = await fs.readdir(inputDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => `./input_data/${e.name}`);
    if (files.length === 0)
      return `${header}\n(no input files — the project has no raw data)`;
    return [
      header,
      "These files exist on disk and are ready to use. Reference them directly",
      'by path. Do NOT skip tests or claim "no data" — the following files are available:',
      "",
      ...files.map((f) => `- \`${f}\``),
    ].join("\n");
  } catch {
    return `${header}\n(no input_data/ directory — the project has no raw data)`;
  }
}

export async function createGeneratorBaseMessage(
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string,
  evaluationStr: string,
  plan?: string,
  outputDir?: string,
  taskType?: string | null
): Promise<AgentMessage[]> {
  const basicSkills = await resolveSkills(generatorBase, taskType);
  const inputFilesSection = await buildInputFilesSection(outputDir);
  const systemPrompt = `
  === BASIC SKILLS ===
  ${basicSkills.join("\n\n")}

  === INSTRUCTIONS ===
  You will get scores for your task from 0-4, 4 is perfect.
  Notice the output format!!!

  === OUTPUT DIRECTORY ===
  The working directory (cwd) is already set to: ${outputDir || "./output"}
  All paths in createFileWithDirectories and executeCommand are relative to this
  directory. Do NOT prefix paths with the output directory path.

  ${inputFilesSection}

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

  ✅ COMPLETED STEPS (already done — surgical edits via executeCommand allowed)
  ─────────────────────────────────────────────────────────────
  These steps have been fully executed. Their outputs are captured
  in "Code Summarization" and "Previous Output" below.
  ${
    artifact.completedSteps.length > 0
      ? artifact.completedSteps
          .map((step, i) => `  [DONE] ${i + 1}. ${step}`)
          .join("\n")
      : "  (all prior steps completed — files listed in SUMMARIZATION below)"
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
  (These files exist on disk. Import and call them directly.
      When the current task requires changes to these files —
      add a function, fix an import, update a constant — use
      executeCommand with sed/tee to surgically edit them.
      Do NOT recreate the entire file from scratch.)
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
