import { createProvider } from "./providers/llm.js";
import { runHarness } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList } from "@/utils/index.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";

async function main() {
  // 1. Create provider
  const provider = createProvider();
  console.log("[INFO] LLM provider created.");

  const schemasPath = await dataPreprocess(INPUT_RAW_DIR, OUTPUT_SCHEMAS_DIR);
  const inputSchemas = await readFilesFromList(schemasPath);
  console.log("[INFO] Input schemas prepared.");

  console.log("[INFO] Starting agent harness...");
  runHarness(provider, inputSchemas);
}

main();
//npx tsx main.ts
