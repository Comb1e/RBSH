// ---------------------------------------------------------------------------
// Main harness orchestrator
// Runs Planner → (Generator ↔ Evaluator) loop over each planned step
// ---------------------------------------------------------------------------

import { runPlanner } from "./planner.js";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import { runComprehension } from "./comprehension.js";
import type {
  HandoffArtifact,
  LLMProvider,
  ScoreExtractionResult,
  GeneratorEvaluatorLoopCompletion,
} from "@/types//index.js";
import { env } from "../config/env.js";
import { readFilesFromRecord, extractOverallScore } from "@/utils/index.js";
import { extractSpreadsheetAnalysis } from "@/schemas/index.js";

// ---------------------------------------------------------------------------
// Harness: Generator ↔ Evaluator loop
// Inspired by Generative Adversarial Networks (GANs): a generator produces
// output while an adversarial evaluator drives it toward higher quality.
// ---------------------------------------------------------------------------

async function generatorEvaluatorLoop(
  provider: LLMProvider,
  background: string,
  artifact: HandoffArtifact,
  inputSchemaDescription: string
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
      evaluationStr
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

    // Feed the critique back into the next iteration via the artifact
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
    `\n[WARN]  Max iterations (${env.AGENT_MAX_ITERATIONS}) reached. Returning best attempt.`
  );
  return { content: evaluationStr, toolSummarization: "" };
}

const harnessTask = { prompts: ["user_prompt.md"] };

export async function runHarness(
  provider: LLMProvider,
  inputSchemas: string[]
): Promise<void> {
  const userTaskArray = await readFilesFromRecord(harnessTask);
  const userTask = userTaskArray.join("\n");
  console.log("═".repeat(60));
  console.log("RBSH");
  console.log("═".repeat(60));
  console.log(`\nUser task:\n${userTask}`);

  // 1. Comprehension
  const comprehensionArtifactRaw = await runComprehension(
    provider,
    userTask,
    inputSchemas
  );
  const comprehensionArtifact = extractSpreadsheetAnalysis(
    comprehensionArtifactRaw
  );
  const comprehensionTask = JSON.stringify(comprehensionArtifact.coreProblem);
  const inputSchemaDescription =
    JSON.stringify(comprehensionArtifact.sheets) +
    JSON.stringify(comprehensionArtifact.crossSheetRelationships);

  // 2. Plan
  const steps = await runPlanner(
    provider,
    comprehensionTask,
    inputSchemaDescription
  );

  // 3. Build the initial handoff artifact
  const artifact: HandoffArtifact = {
    task: comprehensionTask,
    completedSteps: [],
    remainingSteps: [...steps],
    preToolSummarize: [],
    iterationCount: 0,
  };

  // 3. Execute each step through the generator ↔ evaluator loop
  let result: GeneratorEvaluatorLoopCompletion = { content: "" };
  for (const step of steps) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`STEP: ${step}`);
    console.log("─".repeat(60));

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    result = await generatorEvaluatorLoop(
      provider,
      artifact.task,
      {
        ...artifact,
        task: step,
      },
      inputSchemaDescription
    );

    artifact.completedSteps.push(step);
    artifact.iterationCount = 0;
    if (result.toolSummarization) {
      artifact.preToolSummarize.push(...result.toolSummarization);
    }
  }

  // 4. Final summary
  console.log("\n" + "═".repeat(60));
  console.log("  FINAL OUTPUT");
  console.log("═".repeat(60));
  console.log(result);
}
