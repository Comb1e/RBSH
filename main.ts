import * as path from "path";
import { createProvider } from "./providers/llm.js";
import { runGenerator, runHarness, plan } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList, input } from "@/utils/index.js";
import type { PlanResult, HandoffArtifact } from "@/types/index.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";
const OUTPUT_DIR = "./output";

/**
 * Derives a project output folder name from the plan file path.
 *   "./output/plan/my-project-plan.md"  →  "./output/my-project"
 *   "./output/plan/analysis.md"         →  "./output/analysis"
 */
function deriveOutputDir(planPath: string): string {
  const base = path.basename(planPath, path.extname(planPath)); // "my-project-plan"
  const name = base.endsWith("-plan") ? base.slice(0, -5) : base; // "my-project"
  return path.join(OUTPUT_DIR, name);
}

async function main() {
  // 0. Parse CLI arguments
  const args = process.argv.slice(2);

  let workType: string = "plan";
  const cliAddFiles: string[] = [];

  const addFlagIdx = args.indexOf("--add");
  if (addFlagIdx !== -1) {
    let i = addFlagIdx + 1;
    while (i < args.length && !args[i].startsWith("-")) {
      cliAddFiles.push(args[i]);
      i++;
    }
    args.splice(addFlagIdx, i - addFlagIdx);
    workType = args[0] || "plan";
  } else {
    workType = args[0] || "plan";
  }

  // 1. Create provider
  const provider = createProvider();
  console.log("[INFO] LLM provider created.");

  // 2. Only preprocess files when --add is specified at the CLI
  let inputSchemas: string[] = [];

  if (cliAddFiles.length > 0) {
    console.log(`[INFO] Adding files: ${cliAddFiles.join(", ")}`);
    const newPaths = await dataPreprocess(
      INPUT_RAW_DIR,
      OUTPUT_SCHEMAS_DIR,
      cliAddFiles
    );
    inputSchemas = await readFilesFromList(newPaths);
    console.log(
      `[INFO] Loaded ${inputSchemas.length} schema(s) from added files.`
    );
  }

  let planPath: string = "";

  while (workType !== "quit") {
    switch (workType) {
      case "new": {
        console.log("[INFO] Starting new plan...");
        workType = "plan";
        break;
      }
      case "plan": {
        if (inputSchemas.length === 0) {
          console.log(
            "[INFO] No input files loaded. Use --add to include Excel or text files."
          );
        }
        const planResult: PlanResult = await plan(
          provider,
          JSON.stringify(inputSchemas)
        );
        workType = planResult.worktype;
        console.log("[INFO] Switching to:", workType);
        planPath = planResult.planPath;

        // If add command came from REPL with file names, process inline
        if (
          workType === "add" &&
          planResult.addFiles &&
          planResult.addFiles.length > 0
        ) {
          const addFiles = planResult.addFiles;
          console.log(`[INFO] Adding files: ${addFiles.join(", ")}`);
          const newPaths = await dataPreprocess(
            INPUT_RAW_DIR,
            OUTPUT_SCHEMAS_DIR,
            addFiles
          );
          const newContents = await readFilesFromList(newPaths);
          inputSchemas.push(...newContents);
          console.log(
            `[INFO] Added ${newContents.length} file(s). Total schemas: ${inputSchemas.length}`
          );
          workType = "plan"; // back to plan mode
        }
        break;
      }
      case "excute": {
        console.log("[INFO] Starting agent harness...");
        if (planPath === "") {
          console.warn("[WARN] No plan available; run 'plan' first.");
          workType = "quit";
        } else {
          const outputDir = deriveOutputDir(planPath);
          await runHarness(provider, planPath, inputSchemas, outputDir);
          workType = "quit";
        }
        break;
      }
      case "generate": {
        console.log("[INFO] Starting generation...");
        if (planPath === "") {
          console.warn("[WARN] No plan available; run 'plan' first.");
          workType = "quit";
        } else {
          const outputDir = deriveOutputDir(planPath);
          const planContents = await readFilesFromList([planPath]);
          const artifactPlan = planContents[0];
          const artifact: HandoffArtifact = {
            task: artifactPlan,
            completedSteps: [],
            remainingSteps: [],
            preToolSummarize: [],
            iterationCount: 0,
          };
          await runGenerator(
            provider,
            artifact,
            artifactPlan,
            JSON.stringify(inputSchemas),
            "",
            artifactPlan,
            outputDir
          );
          workType = "quit";
        }
        break;
      }
      case "add": {
        // REPL "add" without file names — prompt interactively
        console.log("[INFO] Adding new input file(s)...");
        const raw = await input(
          "Enter file name(s) from input_raw/ (space-separated): "
        );
        const names = raw
          .split(/\s+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (names.length === 0) {
          console.log("[INFO] No file names entered.");
        } else {
          const newPaths = await dataPreprocess(
            INPUT_RAW_DIR,
            OUTPUT_SCHEMAS_DIR,
            names
          );
          const newContents = await readFilesFromList(newPaths);
          inputSchemas.push(...newContents);
          console.log(
            `[INFO] Added ${newContents.length} file(s). Total schemas: ${inputSchemas.length}`
          );
        }
        workType = "plan";
        break;
      }
      default: {
        workType = "quit";
        break;
      }
    }
  }
}

main();
//npx tsx main.ts plan
//npx tsx main.ts excute
//npx tsx main.ts --add report.xlsx notes.md
//npx tsx main.ts --add data.xlsx plan
