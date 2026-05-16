import * as fs from "fs";
import * as path from "path";
import type { ParsedPlan } from "@/types/index.js";
import { extractProjectName } from "./output.js";

// ── Response parser ───────────────────────────────────────────────────────────

/**
 * Extracts and validates <FILENAME> and <MARKDOWN> from the model response.
 * Also extracts optional <PROJECT_NAME> when present (no-input plan mode).
 * Throws a descriptive Error so the caller can feed it back to the model.
 */
export function plannerParseResponse(raw: string): ParsedPlan {
  // 1. Outer envelope
  const envelopeMatch = raw.match(/<PLAN_DOCUMENT>([\s\S]*?)<\/PLAN_DOCUMENT>/);
  if (!envelopeMatch) {
    throw new Error(
      "Response is missing the <PLAN_DOCUMENT>…</PLAN_DOCUMENT> envelope.\n" +
        `First 500 chars received:\n${raw.slice(0, 500)}`
    );
  }
  const envelope = envelopeMatch[1];

  // 1b. Optional project name (only emitted in no-input plan mode)
  const projectName = extractProjectName(envelope) || undefined;

  // 2. Markdown body
  const markdownMatch = envelope.match(/<MARKDOWN>([\s\S]*?)<\/MARKDOWN>/);
  if (!markdownMatch) {
    throw new Error(
      "Could not extract the <MARKDOWN>…</MARKDOWN> section from the envelope."
    );
  }
  const markdown = markdownMatch[1].trim();

  // 3. Required section headers
  const requiredSections = [
    "## 1. Project Overview",
    "## 2. Technical Stack",
    "## 3. Module Division",
    "## 4. Development Timeline",
    "## 5. Implementation Order",
  ];
  const missing = requiredSections.filter((s) => !markdown.includes(s));
  if (missing.length > 0) {
    throw new Error(
      `Markdown is missing the following required section header(s):\n` +
        missing.map((s) => `  • "${s}"`).join("\n")
    );
  }

  // 5. Tech-stack table
  if (!markdown.includes("| Category")) {
    throw new Error(
      '"## 2. Technical Stack" must contain a Markdown table whose header row ' +
        "includes the column '| Category |'. That table is absent."
    );
  }

  // 6. Module Division — at least one ### sub-heading
  const moduleHeadings = markdown.match(/^### .+/gm) ?? [];
  if (moduleHeadings.length < 4) {
    throw new Error(
      `"## 3. Module Division" must contain at least 4 ### module sub-headings. ` +
        `Found ${moduleHeadings.length}.`
    );
  }

  // 7. Timeline table
  if (!markdown.includes("| Phase")) {
    throw new Error(
      '"## 4. Development Timeline" must contain a Markdown table whose header ' +
        "row includes the column '| Phase |'. That table is absent."
    );
  }

  // 8. Implementation Order — must contain at least one numbered file entry
  const implOrderMatch = markdown.match(
    /## 5\. Implementation Order\s*\n([\s\S]*?)(?=\n## |$)/
  );
  if (!implOrderMatch) {
    throw new Error(
      '"## 5. Implementation Order" section is missing.'
    );
  }
  const implItems = implOrderMatch[1].match(/^\d+\.\s*`.+`\s*—/gm);
  if (!implItems || implItems.length < 1) {
    throw new Error(
      '"## 5. Implementation Order" must contain at least one numbered item ' +
        'in the format: `1. \\`path/file\\` — description`.'
    );
  }

  return { markdown, projectName };
}

// ── Step extraction ───────────────────────────────────────────────────────────

/**
 * Extracts ordered file-level steps from the plan.
 * Primary source: "## 5. Implementation Order" — a numbered list of files.
 * Fallback: "## 3. Module Division" ### sub-headings (coarse module names).
 *
 * Each step is a string the generator receives as its TASK.
 * For Implementation Order items the format is: `path/to/file.py — description`.
 */
export function extractStepsFromPlan(planMarkdown: string): string[] {
  // Primary: parse Implementation Order
  const implMatch = planMarkdown.match(
    /## 5\. Implementation Order\s*\n([\s\S]*?)(?=\n## |$)/
  );
  if (implMatch) {
    const items = implMatch[1]
      .split("\n")
      .map((line) => {
        const m = line.trim().match(/^\d+\.\s*`([^`]+)`\s*—\s*(.+)$/);
        return m ? `${m[1]} — ${m[2]}` : "";
      })
      .filter(Boolean);
    if (items.length > 0) return items;
  }

  // Fallback: Module Division headings
  console.warn(
    "[WARN] No Implementation Order found; falling back to Module Division headings."
  );
  const sectionMatch = planMarkdown.match(
    /## 3\. Module Division\s*\n([\s\S]*?)(?=\n## |$)/
  );
  if (!sectionMatch) return [];

  const headings = sectionMatch[1].match(/^### (.+)$/gm);
  if (!headings) return [];

  return headings.map((h) => h.replace(/^### /, "").trim());
}

export function writePlanFile(
  filename: string,
  markdown: string,
  outputDir: string
): string {
  const safeFilename = path.basename(filename).replace(/[^a-z0-9\-_.]/gi, "-");
  const filePath = path.join(outputDir, safeFilename);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, markdown, "utf-8");
  return filePath;
}
