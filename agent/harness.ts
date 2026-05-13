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

  const allSummaries = artifact.preToolSummarize;
  if (allSummaries.length > 0) {
    const files = new Map<
      string,
      { summary: string; apis: string[]; variables: string[]; classes: string[] }
    >();

    for (const s of allSummaries) {
      if (s.code_summary) {
        for (const f of s.code_summary) {
          const key = f.file.relative_path || f.file.file_name;
          if (!files.has(key)) {
            files.set(key, {
              summary: f.file.summary || "",
              apis: [],
              variables: [],
              classes: [],
            });
          }
          const entry = files.get(key)!;
          for (const api of f.apis || []) {
            entry.apis.push(`  ${api.name}(${(api.parameters || []).map((p) => p.name).join(", ")}) → ${typeof api.returns === "string" ? api.returns : (api.returns as any)?.description || ""}`);
          }
          for (const v of f.variables || []) {
            entry.variables.push(`  ${v.name}: ${v.type} (${v.scope})`);
          }
          for (const c of f.classes || []) {
            entry.classes.push(`  class ${c.name} — ${c.description || ""}`);
          }
        }
      }
    }

    if (files.size > 0) {
      console.log(`\n  ${files.size} file(s) created:\n`);
      for (const [path, info] of files) {
        console.log(`  📄 ${path}`);
        if (info.summary) console.log(`     ${info.summary}`);
        if (info.classes.length > 0) {
          console.log(`     Classes:`);
          info.classes.forEach((c) => console.log(c));
        }
        if (info.apis.length > 0) {
          console.log(`     Functions:`);
          info.apis.forEach((a) => console.log(a));
        }
        if (info.variables.length > 0) {
          console.log(`     Variables:`);
          info.variables.forEach((v) => console.log(v));
        }
        console.log("");
      }
    } else {
      // Text or config output
      for (const s of allSummaries) {
        if (s.text_summary) {
          console.log(`\n  📝 ${s.purpose || "Report"}: ${s.text_summary.overview || ""}`);
        } else if (s.result) {
          console.log(`\n  ⚙ ${s.purpose || "Result"}: ${s.result}`);
        }
      }
    }
  } else {
    console.log("\n  (No structured output — see output directory for generated files)");
  }

  console.log("═".repeat(60));
}
