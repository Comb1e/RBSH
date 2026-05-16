// ---------------------------------------------------------------------------
// Main harness orchestrator
// Reads the plan (which already incorporates schema comprehension from the
// planner), extracts module steps, and runs each through the Generator ↔
// Evaluator loop.
// ---------------------------------------------------------------------------

import { mkdir } from "fs/promises";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import { setExecuteDefaultCwd } from "../tools/scripts/exec.js";
import type {
  HandoffArtifact,
  LLMProvider,
  ScoreExtractionResult,
  GeneratorEvaluatorLoopCompletion,
} from "@/types/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { env } from "../config/env.js";
import {
  readFilesFromList,
  extractOverallScore,
  extractStepsFromPlan,
  formatToolCallsForNextIteration,
} from "@/utils/index.js";
import {
  checkForInterrupt,
  enableInterruptCapture,
  disableInterruptCapture,
} from "@/utils/input.js";

// ---------------------------------------------------------------------------
// Generator ↔ Evaluator loop
// ---------------------------------------------------------------------------

async function generatorEvaluatorLoop(
  provider: LLMProvider,
  background: string,
  artifact: HandoffArtifact,
  schemaDescription: string,
  plan: string,
  outputDir: string,
  taskType?: string | null
): Promise<GeneratorEvaluatorLoopCompletion> {
  let evaluationStr: string = "";
  let bestDraft: string = "";
  let bestToolSummarization: ToolAnalysisResult[] | undefined;
  let bestScore = -1;

  enableInterruptCapture();
  try {
    for (let iter = 1; iter <= env.GENERATOR_MAX_ITERATIONS; iter++) {
    artifact.iterationCount = iter;

    // ── User interrupt checkpoint ──────────────────────────────────────
    const interrupt = await checkForInterrupt();
    if (interrupt.aborted) {
      console.log("[INFO] Generator-Evaluator loop interrupted by user.");
      return { content: "", toolSummarization: [] };
    }
    if (interrupt.feedback) {
      evaluationStr += `\n\n[USER FEEDBACK]\n${interrupt.feedback}`;
      console.log(
        "[INFO] User feedback appended to evaluation context for next iteration."
      );
    }

    // --- Generate ---
    const generatorCompletion = await runGenerator(
      provider,
      artifact,
      background,
      schemaDescription,
      evaluationStr,
      plan,
      outputDir,
      taskType
    );
    const draft = generatorCompletion.content;
    const toolSummarization = generatorCompletion.toolSummarization;

    // --- Evaluate ---
    const evaluation = await runEvaluator(
      provider,
      background,
      artifact.task,
      draft,
      schemaDescription,
      artifact.preToolSummarize,
      toolSummarization,
      outputDir,
      taskType
    );

    const scoreResult: ScoreExtractionResult = extractOverallScore(
      evaluation.content
    );
    console.log("\n");
    console.log(scoreResult);

    // Track best attempt
    if (scoreResult.score > bestScore) {
      bestScore = scoreResult.score;
      bestDraft = draft;
      bestToolSummarization = toolSummarization;
    }

    if (scoreResult.status === "Pass") {
      console.log("\n[INFO] Output accepted by evaluator.");
      return { content: draft, toolSummarization: toolSummarization };
    }

    // Only feed back the most recent evaluation; summarize prior context
    const toolCallsSummary = formatToolCallsForNextIteration(
      generatorCompletion.content
    );
    evaluationStr = `
--- Previous attempt (score ${scoreResult.score}) ---
${toolCallsSummary}

${evaluation}
      `.trim();

    if (iter < env.GENERATOR_MAX_ITERATIONS) {
      console.log(
        `\n[WARN] Score below threshold. Retrying (${iter}/${env.GENERATOR_MAX_ITERATIONS})…`
      );
    }
  }
} finally {
  disableInterruptCapture();
}

  console.warn(
    `\n[WARN] Max iterations (${env.GENERATOR_MAX_ITERATIONS}) reached. Returning best attempt (score ${bestScore}).`
  );
  return { content: bestDraft || evaluationStr, toolSummarization: bestToolSummarization || [] };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runHarness(
  provider: LLMProvider,
  planPath: string,
  schemaDescription: string,
  outputDir: string,
  taskType?: string | null
): Promise<void> {
  console.log(`[HARNESS] Starting execution → ${outputDir}`);

  await mkdir(outputDir, { recursive: true });
  setExecuteDefaultCwd(outputDir);

  // 1. Read the plan
  const planContents = await readFilesFromList([planPath]);
  const plan = planContents[0];

  if (!plan) {
    console.error("[ERROR] Plan file is empty or unreadable.");
    return;
  }

  // 2. Extract steps
  const steps = extractStepsFromPlan(plan);
  if (steps.length === 0) {
    console.warn("[WARN] No steps found; falling back to single-step execution.");
    steps.push("Execute plan as single step");
  }

  console.log(`[HARNESS] ${steps.length} step(s) to execute.`);

  // 4. Build handoff artifact
  const artifact: HandoffArtifact = {
    task: plan,
    completedSteps: [],
    remainingSteps: [...steps],
    preToolSummarize: [],
    iterationCount: 0,
  };

  // 5. Execute each step through the Generator ↔ Evaluator loop
  let result: GeneratorEvaluatorLoopCompletion = { content: "" };
  for (const step of steps) {
    console.log(`\n[HARNESS] Step: ${step}`);

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    result = await generatorEvaluatorLoop(
      provider,
      plan,
      {
        ...artifact,
        task: step,
      },
      schemaDescription,
      plan,
      outputDir,
      taskType
    );

    artifact.completedSteps.push(step);
    artifact.iterationCount = 0;
    if (result.toolSummarization) {
      artifact.preToolSummarize.push(...result.toolSummarization);
    }
  }

  // 5.5 Final project verification — try to run the whole project
  if (artifact.preToolSummarize.length > 0) {
    console.log(`\n[HARNESS] Final verification — running project`);

    const verifyTask = [
      "ALL FILES ALREADY EXIST. DO NOT CREATE, REWRITE, OR MODIFY ANY FILES.",
      "Your ONLY job is to run the completed project and verify it works.",
      "",
      "1. Look at the SUMMARIZATION OF COMPLETED STEPS below — it lists every file",
      "   that was created. Use readFile to inspect the entry point if needed.",
      "2. Run the project's entry point using executeCommand. Try multiple approaches",
      "   if the first one fails (e.g. python -m main, then python -m src.main).",
      "3. If tests exist, run them.",
      "4. If the project fails, read the error, fix ONLY the broken file, and re-run.",
      "5. Report what you ran and whether it succeeded.",
    ].join("\n");

    const verifyResult = await generatorEvaluatorLoop(
      provider,
      plan,
      {
        task: verifyTask,
        completedSteps: [...artifact.completedSteps],
        remainingSteps: [],
        preToolSummarize: artifact.preToolSummarize,
        iterationCount: 0,
      },
      schemaDescription,
      plan,
      outputDir,
      taskType
    );

    if (verifyResult.toolSummarization) {
      artifact.preToolSummarize.push(...verifyResult.toolSummarization);
    }
  }

  // 6. Final summary
  const allSummaries = artifact.preToolSummarize;
  if (allSummaries.length > 0) {
    const fileSet = new Map<string, string>();
    for (const s of allSummaries) {
      if (s.files) {
        for (const f of s.files) {
          if (!fileSet.has(f.path)) fileSet.set(f.path, f.summary);
        }
      }
      if (s.code_summary) {
        for (const f of s.code_summary) {
          const fp = f.file.relative_path || f.file.file_name;
          if (!fileSet.has(fp)) fileSet.set(fp, f.file.summary || "");
        }
      }
    }

    if (fileSet.size > 0) {
      console.log(`\n[HARNESS] ${fileSet.size} file(s) created:`);
      for (const [filePath, summary] of fileSet) {
        console.log(`  ${filePath}${summary ? ` — ${summary}` : ""}`);
      }
    }
  } else {
    console.log("[HARNESS] No structured output — see output directory for generated files.");
  }
}
