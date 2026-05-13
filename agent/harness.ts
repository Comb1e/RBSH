// ---------------------------------------------------------------------------
// Main harness orchestrator
// Reads the plan (which already incorporates schema comprehension from the
// planner), extracts module steps, and runs each through the Generator ↔
// Evaluator loop.
// ---------------------------------------------------------------------------

import { mkdir } from "fs/promises";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import type {
  HandoffArtifact,
  LLMProvider,
  ScoreExtractionResult,
  GeneratorEvaluatorLoopCompletion,
} from "@/types//index.js";
import { env } from "../config/env.js";
import {
  readFilesFromList,
  extractOverallScore,
  extractStepsFromPlan,
} from "@/utils/index.js";

// ---------------------------------------------------------------------------
// Generator ↔ Evaluator loop
// ---------------------------------------------------------------------------

async function generatorEvaluatorLoop(
  provider: LLMProvider,
  background: string,
  artifact: HandoffArtifact,
  inputSchemaDescription: string,
  plan: string,
  outputDir: string
): Promise<GeneratorEvaluatorLoopCompletion> {
  let evaluationStr: string = "";
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    artifact.iterationCount = iter;

    // --- Generate ---
    const generatorCompletion = await runGenerator(
      provider,
      artifact,
      background,
      inputSchemaDescription,
      evaluationStr,
      plan,
      outputDir
    );
    const draft = generatorCompletion.content;
    const toolSummarization = generatorCompletion.toolSummarization;

    // --- Evaluate ---
    const evaluation = await runEvaluator(
      provider,
      background,
      artifact.task,
      draft,
      inputSchemaDescription,
      artifact.preToolSummarize
    );

    const scoreResult: ScoreExtractionResult = extractOverallScore(
      evaluation.content
    );
    console.log("\n");
    console.log(scoreResult);
    if (scoreResult.status === "Pass") {
      console.log("\n[INFO] Output accepted by evaluator.");
      return { content: draft, toolSummarization: toolSummarization };
    }

    evaluationStr = `
  --- Previous attempt (score ${scoreResult.score}) ---
  ${draft}

  --- Evaluation ---
  ${evaluation}
      `.trim();

    if (iter < env.AGENT_MAX_ITERATIONS) {
      console.log(
        `\n[WARN] Score below threshold. Retrying (${iter}/${env.AGENT_MAX_ITERATIONS})…`
      );
    }
  }

  console.warn(
    `\n[WARN] Max iterations (${env.AGENT_MAX_ITERATIONS}) reached. Returning best attempt.`
  );
  return { content: evaluationStr, toolSummarization: [] };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runHarness(
  provider: LLMProvider,
  planPath: string,
  inputSchemas: string[],
  outputDir: string
): Promise<void> {
  console.log("═".repeat(60));
  console.log("RBSH");
  console.log("═".repeat(60));

  // 0. Create the output directory
  await mkdir(outputDir, { recursive: true });
  console.log(`[INFO] Output directory: ${outputDir}`);

  // 1. Read the plan (already incorporates schema comprehension)
  const planContents = await readFilesFromList([planPath]);
  const plan = planContents[0];

  if (!plan) {
    console.error("[ERROR] Plan file is empty or unreadable.");
    return;
  }

  // 2. Extract steps from the plan's Module Division
  const steps = extractStepsFromPlan(plan);
  if (steps.length === 0) {
    console.warn(
      "[WARN] No module steps found in plan; falling back to single-step execution."
    );
    steps.push("Execute plan as single step");
  }

  console.log(`[INFO] Plan loaded. ${steps.length} step(s) to execute.`);

  // 3. Raw schema description — the generator already has the plan for context
  const inputSchemaDescription = JSON.stringify(inputSchemas);

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
    console.log(`\n${"─".repeat(60)}`);
    console.log(`STEP: ${step}`);
    console.log("─".repeat(60));

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    result = await generatorEvaluatorLoop(
      provider,
      plan,
      {
        ...artifact,
        task: step,
      },
      inputSchemaDescription,
      plan,
      outputDir
    );

    artifact.completedSteps.push(step);
    artifact.iterationCount = 0;
    if (result.toolSummarization) {
      artifact.preToolSummarize.push(...result.toolSummarization);
    }
  }

  // 6. Final summary
  console.log("\n" + "═".repeat(60));
  console.log("  FINAL OUTPUT");
  console.log("═".repeat(60));
  console.log(result);
}
