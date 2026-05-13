import type { LLMProvider } from "@/types/index.js";
import { getExplainerPrompt } from "@/prompts/explainer.js";
import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import { env } from "../config/env.js";

export async function runExplainer(
  provider: LLMProvider,
  inputSchemas: string,
  planContext: string,
  outputDir: string
): Promise<string> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EXPLAINER AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  const agentMessages = await getExplainerPrompt(inputSchemas, planContext);

  let markdown = "";
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(agentMessages, {});
    if (completion.content && completion.content.trim() !== "") {
      markdown = completion.content;
      break;
    }
    console.log(`[WARN] Explainer returned empty content; retrying (${iter}/${env.AGENT_MAX_ITERATIONS})…`);
  }

  if (!markdown) {
    console.warn("[WARN] Explainer failed to produce output.");
    return "";
  }

  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "schema.md");
  await writeFile(filePath, markdown, "utf-8");
  console.log(`[INFO] Schema explanation written to: ${filePath}`);
  return filePath;
}
