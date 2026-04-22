// ---------------------------------------------------------------------------
// Main harness orchestrator
// Runs Planner → (Generator ↔ Evaluator) loop over each planned step
// ---------------------------------------------------------------------------

import { runPlanner } from "./planner.js";
import { runGenerator } from "./generator.js";
import { runEvaluator } from "./evaluator.js";
import { runSummarizer } from "./summarizer.js";
import { runComprehension } from "./comprehension.js";
import type {
  HandoffArtifact,
  LLMProvider,
  ScoreExtractionResult,
  CodeUnifiedInfo,
} from "@/types//index.js";
import { env } from "../config/env.js";
import { readFilesFromRecord, extractOverallScore } from "@/utils/index.js";
import {
  saveMarkdownCodeBlocksToFile,
  extractMarkdownCodeBlocks,
  extractFileAndFolderFromText,
} from "@/utils/output.js";
import type { CodeAnalysisResult } from "@/schemas/index.js";
import {
  CodeAnalysisSchema,
  extractSpreadsheetAnalysis,
} from "@/schemas/index.js";

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
): Promise<string> {
  let currentOutput = artifact.currentOutput;
  let maxScore = 0;

  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    artifact.iterationCount = iter;
    artifact.currentOutput = currentOutput;

    // --- Generate ---
    const draft = await runGenerator(
      provider,
      artifact,
      background,
      inputSchemaDescription
    );

    // --- Evaluate ---
    const evaluation = await runEvaluator(
      provider,
      background,
      artifact.task,
      draft,
      inputSchemaDescription,
      artifact.preCodeSummarize
    );

    const scoreResult: ScoreExtractionResult = extractOverallScore(evaluation);
    console.log("\n");
    console.log(scoreResult);
    if (scoreResult.status === "Pass") {
      console.log("\n[INFO] Output accepted by evaluator.");
      return draft;
    }

    // Feed the critique back into the next iteration via the artifact
    currentOutput = `
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
    if (maxScore < scoreResult.score) {
      maxScore = scoreResult.score;
      artifact.preMaxOutput = "";
    } else {
      artifact.preMaxOutput =
        artifact.preMaxOutput === ""
          ? artifact.currentOutput
          : artifact.preMaxOutput;
    }
  }

  console.warn(
    `\n[WARN]  Max iterations (${env.AGENT_MAX_ITERATIONS}) reached. Returning best attempt.`
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
    currentOutput: "",
    preCodeSummarize: [],
    preMaxOutput: "",
    iterationCount: 0,
  };

  // 3. Execute each step through the generator ↔ evaluator loop
  for (const step of steps) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`STEP: ${step}`);
    console.log("─".repeat(60));

    artifact.remainingSteps = artifact.remainingSteps.slice(1);

    const result = await generatorEvaluatorLoop(
      provider,
      artifact.task,
      {
        ...artifact,
        task: step,
      },
      inputSchemaDescription
    );

    const extractedPath = extractFileAndFolderFromText(step);
    console.log("extractedPath: ", extractedPath);
    const fileName = extractedPath
      ? extractedPath.file
      : step.replace(/\s+/g, "_").toLowerCase();
    console.log("fileName: ", fileName);
    const outputPath = extractedPath ? extractedPath.folder : "";
    console.log("outputPath: ", outputPath);
    const extractedCodeInfos: CodeUnifiedInfo[] =
      await saveMarkdownCodeBlocksToFile(result, outputPath, fileName);

    // Context reset: only the structured artifact crosses session boundaries
    for (const info of extractedCodeInfos) {
      if (artifact.remainingSteps.length === 0) {
        return;
      }
      const codeSummarize = await runSummarizer(provider, info.code, info.path);
      const cleaned = extractMarkdownCodeBlocks(codeSummarize);
      console.log(cleaned);

      for (const block of cleaned) {
        const parsed: CodeAnalysisResult = CodeAnalysisSchema.parse(
          JSON.parse(block.content)
        );
        artifact.preCodeSummarize.push(parsed);
      }
    }
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
