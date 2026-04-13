// ---------------------------------------------------------------------------
// Main harness orchestrator
// Runs Planner → (Generator ↔ Evaluator) loop over each planned step
// ---------------------------------------------------------------------------

import { runPlanner } from "./planner.js";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import type { HandoffArtifact, LLMProvider } from "@/types//index.js";
import { env } from "../config/env.js";

// ---------------------------------------------------------------------------
// Harness: Generator ↔ Evaluator loop
// Inspired by Generative Adversarial Networks (GANs): a generator produces
// output while an adversarial evaluator drives it toward higher quality.
// ---------------------------------------------------------------------------

async function generatorEvaluatorLoop(
  provider: LLMProvider,
  artifact: HandoffArtifact
): Promise<string> {
  let currentOutput = artifact.currentOutput;

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    artifact.iterationCount = iter;
    artifact.currentOutput = currentOutput;

    // --- Generate ---
    const draft = await runGenerator(provider, artifact);
    console.log(
      `\nDraft output (${draft.length} chars):\n${draft.slice(0, 300)}…\n`
    );

    // --- Evaluate ---
    const evaluation = await runEvaluator(provider, artifact.task, draft);
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
  }

  console.warn(
    `\n⚠️  Max iterations (${env.AGENT_MAX_ITERATIONS}) reached. Returning best attempt.`
  );
  return currentOutput;
}

export async function runHarness(
  provider: LLMProvider,
  userTask: string
): Promise<void> {
  console.log("═".repeat(60));
  console.log("RBSH");
  console.log("═".repeat(60));
  console.log(`\nUser task: ${userTask}\n`);

  // 1. Plan
  const steps = await runPlanner(provider, userTask);

  // 2. Build the initial handoff artifact
  const artifact: HandoffArtifact = {
    task: userTask,
    completedSteps: [],
    remainingSteps: [...steps],
    currentOutput: "",
    iterationCount: 0,
  };

  // 3. Execute each step through the generator ↔ evaluator loop
  for (const step of steps) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`STEP: ${step}`);
    console.log("─".repeat(60));

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    const result = await generatorEvaluatorLoop(provider, {
      ...artifact,
      task: step,
    });

    // Context reset: only the structured artifact crosses session boundaries
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
