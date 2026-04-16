// ---------------------------------------------------------------------------
// Main harness orchestrator
// Runs Planner → (Generator ↔ Evaluator) loop over each planned step
// ---------------------------------------------------------------------------

import { runPlanner } from "./planner.js";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import type { HandoffArtifact, LLMProvider } from "@/types//index.js";
import { env } from "../config/env.js";
import { readFilesFromRecord } from "@/utils/get_params.js";
import { saveMarkdownCodeBlocksToFile } from "@/utils/output.js";

const OUTPUT_PATH = "./output";

// ---------------------------------------------------------------------------
// Harness: Generator ↔ Evaluator loop
// Inspired by Generative Adversarial Networks (GANs): a generator produces
// output while an adversarial evaluator drives it toward higher quality.
// ---------------------------------------------------------------------------

async function generatorEvaluatorLoop(
  provider: LLMProvider,
  artifact: HandoffArtifact,
  inputSchemas: string[]
): Promise<string> {
  let currentOutput = artifact.currentOutput;
  let maxScore = 0;

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    artifact.iterationCount = iter;
    artifact.currentOutput = currentOutput;

    // --- Generate ---
    const draft = await runGenerator(provider, artifact, inputSchemas);

    // --- Evaluate ---
    const evaluation = await runEvaluator(
      provider,
      artifact.task,
      draft,
      inputSchemas
    );
    console.log(
      `\nEvaluation  score=${evaluation.score}/10  passed=${evaluation.passed}`
    );
    console.log(`Critique: ${evaluation.critique}`);

    if (evaluation.passed) {
      console.log("\n✅ Output accepted by evaluator.");
      return draft;
    }

    // Feed the critique back into the next iteration via the artifact
    currentOutput = `
  --- Previous attempt (score ${evaluation.score}/10) ---
  ${draft}

  --- Evaluator critique ---
  ${evaluation.critique}

  --- Suggested revision ---
  ${evaluation.suggestedRevision}
      `.trim();

    if (iter < env.AGENT_MAX_ITERATIONS) {
      console.log(
        `\n🔁 Score below threshold. Retrying (${iter}/${env.AGENT_MAX_ITERATIONS})…`
      );
    }
    if (maxScore < evaluation.score) {
      maxScore = evaluation.score;
      artifact.preMaxOutput = "";
    } else {
      artifact.preMaxOutput =
        artifact.preMaxOutput === ""
          ? artifact.currentOutput
          : artifact.preMaxOutput;
    }
  }

  console.warn(
    `\n⚠️  Max iterations (${env.AGENT_MAX_ITERATIONS}) reached. Returning best attempt.`
  );
  return currentOutput;
}

const harnessTask = { prompts: "user_prompt.md" };

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

  // 1. Plan
  const steps = await runPlanner(provider, userTask);

  // 2. Build the initial handoff artifact
  const artifact: HandoffArtifact = {
    task: userTask,
    completedSteps: [],
    remainingSteps: [...steps],
    currentOutput: "",
    preMaxOutput: "",
    iterationCount: 0,
  };

  // 3. Execute each step through the generator ↔ evaluator loop
  for (const step in steps) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`STEP: ${step}`);
    console.log("─".repeat(60));

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    const result = await generatorEvaluatorLoop(
      provider,
      {
        ...artifact,
        task: step,
      },
      inputSchemas
    );

    // Context reset: only the structured artifact crosses session boundaries
    saveMarkdownCodeBlocksToFile(
      result,
      OUTPUT_PATH,
      `${step.replace(/\s+/g, "_")}`
    );
    artifact.completedSteps.push(step);
    artifact.currentOutput = result;
    artifact.iterationCount = 0;
  }

  // 4. Final summary
  console.log("\n" + "═".repeat(60));
  console.log("  FINAL OUTPUT");
  console.log("═".repeat(60));
  console.log(artifact.currentOutput);
}
