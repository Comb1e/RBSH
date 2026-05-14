import type { LLMProvider } from "@/types/index.js";
import { getExplainerPrompt } from "@/prompts/explainer.js";
import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import { env } from "../config/env.js";

export interface ExplainerResult {
  schemaPath: string;
  projectDir: string;
}

function extractProjectName(raw: string): string {
  const m = raw.match(/<PROJECT_NAME>\s*([\w]+)\s*<\/PROJECT_NAME>/i);
  return m ? m[1].trim() : "";
}

function stripProjectNameTag(raw: string): string {
  return raw.replace(/<PROJECT_NAME>[\s\S]*?<\/PROJECT_NAME>\s*/i, "").trim();
}

export async function runExplainer(
  provider: LLMProvider,
  inputSchemas: string,
  userPrompt: string,
  outputDir?: string
): Promise<ExplainerResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log("║  EXPLAINER AGENT             ║");
  console.log("╚══════════════════════════════╝\n");

  const agentMessages = await getExplainerPrompt(inputSchemas, userPrompt);

  let raw = "";
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(agentMessages, {});
    if (completion.content && completion.content.trim() !== "") {
      raw = completion.content;
      break;
    }
    console.log(`[WARN] Explainer returned empty content; retrying (${iter}/${env.AGENT_MAX_ITERATIONS})…`);
  }

  if (!raw) {
    console.warn("[WARN] Explainer failed to produce output.");
    return { schemaPath: "", projectDir: "" };
  }

  // Determine project directory
  let projectDir: string;
  if (outputDir) {
    projectDir = outputDir;
  } else {
    const name = extractProjectName(raw);
    if (!name) {
      console.warn("[WARN] Explainer did not provide a project name. Using fallback.");
      projectDir = "./output/untitled";
    } else {
      projectDir = `./output/${name}`;
    }
  }

  const markdown = stripProjectNameTag(raw);

  await mkdir(projectDir, { recursive: true });
  const filePath = path.join(projectDir, "schema.md");
  await writeFile(filePath, markdown, "utf-8");
  console.log(`[INFO] Schema explanation written to: ${filePath}`);
  return { schemaPath: filePath, projectDir };
}
