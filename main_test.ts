import { createProvider } from "./providers/llm.js";
import { runHarness } from "@/agent/index.js";
import {
  dataPreprocess,
  readFilesFromList,
  readFilesFromRecord,
} from "@/utils/index.js";
import { runEvaluator, runGenerator } from "@/agent/index.js";
import { getEvaluatorPrompt } from "@/prompts/index.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";

const harnessTask = { prompts: ["user_prompt.md"] };

async function main_test() {
  // 1. Create provider
  const provider = createProvider();
  console.log("[INFO] LLM provider created.");

  const userTaskArray = await readFilesFromRecord(harnessTask);
  const userTask = userTaskArray.join("\n");
  /*
  await runGenerator(
    provider,
    {
      task: "写一段systemverilog实现3:8解码器的testbench，文件放在./output中",
      completedSteps: [],
      remainingSteps: [],
      preToolSummarize: [],
      iterationCount: 0,
    },
    "",
    "",
    ""
  );
  */

  await runEvaluator(
    provider,
    "",
    "Create #output/main.py# implementing a random forest classifier in Python using scikit-learn",
    "Created ./output/main.py implementing a scikit-learn Random Forest classifier with synthetic data, training, evaluation, and model saving.", //output
    "",
    []
  );

  /*
  const schemasPath = await dataPreprocess(INPUT_RAW_DIR, OUTPUT_SCHEMAS_DIR);
  const inputSchemas = await readFilesFromList(schemasPath);
  console.log("[INFO] Input schemas prepared.");

  console.log("[INFO] Starting agent harness...");
  runHarness(provider, inputSchemas);*/
}

main_test();
//npx tsx main.ts
