import type { LLMProvider } from "@/types/index.js";
import { getExplainerPrompt, buildColumnScaffolding } from "@/prompts/explainer.js";
import { mkdir, writeFile } from "fs/promises";
import * as path from "path";
import { env } from "../config/env.js";

export interface ExplainerResult {
  schemaPath: string;
  projectDir: string;
}

function sanitizeRaw(raw: string): string {
  let s = raw.trim();

  // Strip leading/trailing code fences around entire output
  const fenceWrapped = s.match(/^```\w*\s*\n([\s\S]*)\n```\s*$/);
  if (fenceWrapped) {
    s = fenceWrapped[1].trim();
  }

  // Strip code fences around just the PROJECT_NAME tag
  s = s.replace(
    /```\w*\s*\n\s*(<PROJECT_NAME>[\s\S]*?<\/PROJECT_NAME>)\s*\n\s*```/gi,
    "$1"
  );

  // Strip inline backtick wrapping (single backtick, not part of a fence)
  s = s.replace(
    /(?<!`)`(<PROJECT_NAME>[\s\S]*?<\/PROJECT_NAME>)`(?!`)/gi,
    "$1"
  );

  return s.trim();
}

function extractProjectName(raw: string): string {
  const s = sanitizeRaw(raw);
  const m = s.match(/<PROJECT_NAME>\s*([\w-]+)\s*<\/PROJECT_NAME>/i);
  return m ? m[1].trim() : "";
}

function stripProjectNameTag(raw: string): string {
  const s = sanitizeRaw(raw);
  return s.replace(/<PROJECT_NAME>[\s\S]*?<\/PROJECT_NAME>\s*/i, "").trim();
}

export async function runExplainer(
  provider: LLMProvider,
  inputSchemas: string,
  userPrompt: string,
  outputDir?: string
): Promise<ExplainerResult> {
  console.log(`\n[EXPLAINER]`);

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

  // Validate that column names in output match the input schema
  const { knownColumns } = buildColumnScaffolding(inputSchemas);
  if (knownColumns.size > 0) {
    // Extract all backtick-delimited tokens from the markdown (column names in tables)
    const backtickPattern = /`([^`]+)`/g;
    let match: RegExpExecArray | null;
    const translated: string[] = [];
    while ((match = backtickPattern.exec(markdown)) !== null) {
      const name = match[1];
      // Skip non-column tokens (URLs, code snippets, etc.)
      if (name.length > 60 || name.includes("://") || name.includes("\n")) continue;
      if (!knownColumns.has(name) && !translated.includes(name)) {
        translated.push(name);
      }
    }
    if (translated.length > 0) {
      console.warn(
        `[WARN] Explainer may have translated ${translated.length} column name(s): ${translated.join(", ")}`
      );
    }
  }

  await mkdir(projectDir, { recursive: true });
  const filePath = path.join(projectDir, "schema.md");
  await writeFile(filePath, markdown, "utf-8");
  console.log(`[INFO] Schema explanation written to: ${filePath}`);
  return { schemaPath: filePath, projectDir };
}
