import { createProvider } from "./providers/llm.js";
import { runHarness } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList } from "@/utils/index.js";
import { runEvaluator, runGenerator } from "@/agent/index.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";

async function main_test() {
  // 1. Create provider
  const provider = createProvider();
  console.log("[INFO] LLM provider created.");

  await runGenerator(
    provider,
    {
      task: "Create output/main.py to print 'hello world'",
      completedSteps: [],
      remainingSteps: [],
      preToolSummarize: [],
      iterationCount: 0,
    },
    "",
    "",
    ""
  );
  /*
  await runEvaluator(
    provider,
    "",
    "Create #output/main.py# to implement Principal Component Analysis (PCA) using scikit-learn, with support for loading input data from a CSV file or pandas DataFrame, fitting the PCA model, and printing explained variance ratios and transformed components",
    "Created ./output/main.py implementing PCA with CSV/DataFrame input support, standardization, explained variance reporting, and component inspection.",
    "",
    []
  );
  */
  /*
  const schemasPath = await dataPreprocess(INPUT_RAW_DIR, OUTPUT_SCHEMAS_DIR);
  const inputSchemas = await readFilesFromList(schemasPath);
  console.log("[INFO] Input schemas prepared.");

  console.log("[INFO] Starting agent harness...");
  runHarness(provider, inputSchemas);*/
}

main_test();
//npx tsx main.ts
