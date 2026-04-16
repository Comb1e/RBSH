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

  const schemasPath = await dataPreprocess(INPUT_RAW_DIR, OUTPUT_SCHEMAS_DIR);
  const inputSchemas = await readFilesFromList(schemasPath);
  runHarness(provider, inputSchemas);
}

main();
//npx tsx main.ts
