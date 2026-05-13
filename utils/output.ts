import * as fs from "fs/promises";
import * as path from "path";
import {
  CodeBlock,
  ScoreExtractionResult,
  CodeUnifiedInfo,
} from "@/types/index.js";

const OUTPUT_PATH = "./output";

/**
 * Maps language identifiers to file extensions.
 */
const LANG_EXT_MAP: Record<string, string> = {
  javascript: ".js",
  js: ".js",
  typescript: ".ts",
  ts: ".ts",
  jsx: ".jsx",
  tsx: ".tsx",

  python: ".py",
  py: ".py",

  java: ".java",

  c: ".c",
  cpp: ".cpp",
  cplusplus: ".cpp",
  h: ".h",
  hpp: ".hpp",

  go: ".go",
  golang: ".go",

  rust: ".rs",

  html: ".html",
  css: ".css",
  scss: ".scss",
  less: ".less",

  json: ".json",
  yaml: ".yaml",
  yml: ".yml",
  xml: ".xml",
  sql: ".sql",
  csv: ".csv",

  bash: ".sh",
  sh: ".sh",
  zsh: ".zsh",
  shell: ".sh",

  markdown: ".md",
  md: ".md",
  txt: ".txt",
  plaintext: ".txt",
};

/**
 * ✅ NEW: Extract code blocks from markdown
 */
export function extractMarkdownCodeBlocks(markdown: string): CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;

  const blocks: CodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const language = match[1]?.toLowerCase() || "";
    const content = match[2].trim();

    blocks.push({
      language,
      content,
    });
  }

  return blocks;
}

function extractFilename(code: string): string {
  // Split into lines
  const lines = code.trim().split("\n");

  // Check first two lines
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (line === "") continue;

    // Handle // comments (C++, Go, TypeScript, JavaScript, etc.)
    let filename = line.match(
      /^\s*\/\/\s*(.+\.(?:cpp|h|go|ts|js|py|rs|java|kt|swift|php|rb|cs))$/i
    )?.[1];
    if (filename) return filename;

    // Handle # comments (Python, Ruby, etc.)
    filename = line.match(
      /^\s*#\s*(.+\.(?:py|rb|pl|sh|bash|zsh|fish|ps1|mk|cmake))$/i
    )?.[1];
    if (filename) return filename;

    // Handle """ docstring (Python) - filename on first line after """
    if (line.match(/^\s*"""/)) {
      // Check next line for filename
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        filename = nextLine.match(
          /^(.+\.(?:py|txt|md|rst|json|yaml|yml|xml))$/i
        )?.[1];
        if (filename) return filename;
      }
    }

    // Handle /* comments (C, C++, Java, etc.) - filename on next line
    if (line.match(/^\s*\/\*/)) {
      // Check next line for filename
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        filename = nextLine.match(
          /^(.+\.(?:c|cpp|h|hpp|java|js|ts|rs|go))$/i
        )?.[1];
        if (filename) return filename;
      }
    }

    // Handle standalone filename line (no comment markers, just a filename)
    // This catches cases where the filename is on a line by itself
    filename = line.match(
      /^(.+\.(?:cpp|h|py|go|ts|js|rs|java|kt|swift|php|rb|cs|sh|pl|pm|t|pod|md|txt|json|yaml|yml|xml|html|css|scss|sass|less))$/i
    )?.[1];
    if (filename) return filename;

    // Handle inline filename within multi-line comment start (e.g., "/* main.cpp */")
    filename = line.match(
      /^\s*\/\*\s*(.+\.(?:c|cpp|h|hpp|java|js|ts|rs|go))\s*\*\/$/i
    )?.[1];
    if (filename) return filename;

    // Handle inline filename within """ (e.g., """binary_tree.py""")
    filename = line.match(/^\s*"""(?:[^"]*\.(?:py|txt|md))"""?$/i)?.[1];
    if (filename) return filename;
  }

  return "untitled.txt";
}

/**
 * Save extracted code blocks into files
 */
export async function saveMarkdownCodeBlocksToFile(
  markdownContent: string
): Promise<CodeUnifiedInfo[]> {
  const blocks = extractMarkdownCodeBlocks(markdownContent);

  const createdFiles: CodeUnifiedInfo[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const { language, content } = blocks[i];
    const fileName = extractFilename(content);

    let ext = ".txt";
    if (language && LANG_EXT_MAP[language]) {
      ext = LANG_EXT_MAP[language];
    }

    const filePath = path.join(OUTPUT_PATH, fileName);
    const outputDir = path.dirname(filePath);
    await fs.mkdir(outputDir, { recursive: true });

    try {
      await fs.writeFile(filePath, content);
      createdFiles.push({
        path: outputDir,
        code: content,
      });
      console.log(`[INFO] Saved: ${filePath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to save ${filePath}:`, error);
    }
  }

  if (createdFiles.length === 0) {
    console.log("[INFO] No code blocks found.");
  }

  return createdFiles;
}

/**
 * Extracts code blocks wrapped in ```markdown``` fences from a string.
 * Correctly handles nested code blocks (e.g., ```python inside ```markdown).
 *
 * @param text - The input string containing markdown content
 * @returns Array of extracted code block contents (excluding the outer ```markdown fences)
 */
export async function extractMarkdownAndSave(text: string): Promise<string[]> {
  const results: string[] = [];
  const lines = text.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Match opening fence: ```markdown or ~~~markdown (case-insensitive language tag)
    const startMatch = trimmed.match(/^(`{3,}|~{3,})markdown\s*$/i);

    if (startMatch) {
      const fenceChar = startMatch[1][0]; // ` or ~
      const minFenceLen = startMatch[1].length;
      const blockContent: string[] = [];

      i++; // Skip the opening fence line
      let nestedDepth = 0; // Track nested fenced code blocks

      while (i < lines.length) {
        const currentLine = lines[i];
        const currentTrimmed = currentLine.trim();

        // Check if line starts with a fence of the same character type
        const fenceRegex = new RegExp(`^(${fenceChar}{3,})(.*)$`);
        const fenceMatch = currentTrimmed.match(fenceRegex);

        if (fenceMatch) {
          const [_, fenceStr, afterFence] = fenceMatch;
          const fenceLen = fenceStr.length;
          const afterTrimmed = afterFence.trim();

          // A closing fence has ONLY fence chars + optional whitespace (no language identifier)
          const isClosingFence = afterTrimmed === "";

          if (isClosingFence && fenceLen >= minFenceLen) {
            if (nestedDepth > 0) {
              // This closes a nested code block (e.g., ```python)
              nestedDepth--;
              blockContent.push(currentLine);
              i++;
              continue;
            } else {
              // This closes the main ```markdown block - extraction complete
              results.push(blockContent.join("\n"));
              i++; // Skip the closing fence line
              break;
            }
          } else {
            // This fence starts a nested code block (has language identifier like ```python)
            nestedDepth++;
            blockContent.push(currentLine);
            i++;
            continue;
          }
        }

        // Regular content line - just add to the block
        blockContent.push(currentLine);
        i++;
      }
    } else {
      i++;
    }
  }

  await fs.writeFile(path.join(OUTPUT_PATH, "README.md"), results[0]);
  return results;
}

/**
 * Extracts the content inside <TASK_COMPLETE>...</TASK_COMPLETE> XML tags.
 * Case-insensitive. Also tolerates leading/trailing whitespace around the content.
 */
export function extractTaskCompleteContent(input: string): string | null {
  const regex = /<TASK_COMPLETE>\s*([\s\S]*?)\s*<\/TASK_COMPLETE>/i;
  const match = input.match(regex);

  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  console.log("[INFO] No <TASK_COMPLETE> block found.");
  return null;
}

/**
 * Extracts the content inside <SUMMARIZATION>...</SUMMARIZATION> XML tags.
 * Case-insensitive. Also tolerates leading/trailing whitespace around the content.
 */
export function extractSummarizationContent(input: string): string | null {
  const regex = /<SUMMARIZATION>\s*([\s\S]*?)\s*<\/SUMMARIZATION>/i;
  const match = input.match(regex);

  if (match && match[1] !== undefined) {
    return match[1].trim();
  }
  console.log("[INFO] No <SUMMARIZATION> block found.");
  return null;
}

export function serializeResult(result: unknown): string {
  if (result === null) return "null";
  if (result === undefined) return "undefined";

  if (typeof result === "string") return result;

  try {
    return JSON.stringify(result);
  } catch {
    // Handle circular references and other non-serializable values
    return String(result);
  }
}

/**
 * Extracts the overall score and pass/fail status from a text string.
 *
 * @param text - The input string containing score information.
 * @returns An object with score and status, or null if not found.
 */
export function extractOverallScore(text: string): ScoreExtractionResult {
  if (!text || typeof text !== "string") {
    return {
      score: 0,
      status: "Fail",
    };
  }

  // Strategy:
  // 1. Look for the "## Overall Score" header.
  // 2. Capture the number (integer or decimal) following it.
  // 3. Capture the "Pass" or "Fail" keyword appearing after the score.

  // Regex Explanation:
  // ##\s*Overall\s+Score : Matches the header "## Overall Score" (flexible whitespace)
  // \s*                  : Optional whitespace/newlines after header
  // (\d+(?:\.\d+)?)      : Capture Group 1: The score (e.g., 4.0, 4, 92.5)
  // .*?                  : Non-greedy match for any characters in between (e.g., "/ 4.0 —")
  // (Pass|Fail)          : Capture Group 2: The status "Pass" or "Fail"
  // i                    : Case-insensitive flag
  const regex =
    /##\s*Overall\s+Score[\s\S]*?(\d+(?:\.\d+)?)[\s\S]*?(Pass|Fail)/i;

  const match = text.match(regex);

  if (!match) {
    return {
      score: 0,
      status: "Fail",
    };
  }

  const scoreStr = match[1];
  const statusStr = match[2].toLowerCase();

  const score = parseFloat(scoreStr);

  if (isNaN(score)) {
    return {
      score: 0,
      status: "Fail",
    };
  }

  return {
    score: score,
    // Normalize to capitalized 'Pass' or 'Fail'
    status: statusStr === "pass" ? "Pass" : "Fail",
  };
}
