import * as fs from "fs";
import * as path from "path";
import type { ParsedPlan } from "@/types/index.js";
// ── Response parser ───────────────────────────────────────────────────────────

/**
 * Extracts and validates <FILENAME> and <MARKDOWN> from the model response.
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

  // 2. Filename
  const filenameMatch = envelope.match(
    /<FILENAME>\s*([\w][\w\-]*\.md)\s*<\/FILENAME>/i
  );
  if (!filenameMatch) {
    throw new Error(
      "Could not extract a valid <FILENAME>…</FILENAME> tag. " +
        "It must contain a kebab-case filename ending in .md, with no path separators."
    );
  }
  const filename = filenameMatch[1].trim();

  // 3. Markdown body
  const markdownMatch = envelope.match(/<MARKDOWN>([\s\S]*?)<\/MARKDOWN>/);
  if (!markdownMatch) {
    throw new Error(
      "Could not extract the <MARKDOWN>…</MARKDOWN> section from the envelope."
    );
  }
  const markdown = markdownMatch[1].trim();

  // 4. Required section headers
  const requiredSections = [
    "## 1. Project Overview",
    "## 2. Technical Stack",
    "## 3. Module Division",
    "## 4. Development Timeline",
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

  return { filename, markdown };
}

// ── File writer ───────────────────────────────────────────────────────────────

/**
 * Writes the Markdown content to disk.
 * Sanitises the filename to prevent path-traversal before writing.
 */
/**
 * Extracts step names from the "## 3. Module Division" section of a plan.
 * Each ### sub-heading under that section becomes a step.
 */
export function extractStepsFromPlan(planMarkdown: string): string[] {
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
