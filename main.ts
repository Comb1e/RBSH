import { createProvider } from "./providers/llm.js";
import { runHarness } from "@/agent/index.js";
import { getFile } from "./utils/get_params.js";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const USER_PROMPT_PATH = path.resolve(ROOT_DIR, "/prompts/user_prompt.md");

async function main() {
  const provider = createProvider();
  const user_prompt = await getFile(USER_PROMPT_PATH);
  //runHarness(provider, user_prompt);
}

main();
//npx tsx main.ts
