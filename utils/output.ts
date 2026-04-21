import * as fs from "fs/promises";
import * as path from "path";
import {
  CodeBlock,
  PathExtractionResult,
  CodeUnifiedInfo,
} from "@/types/index.js";

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

/**
 * Save extracted code blocks into files
 */
export async function saveMarkdownCodeBlocksToFile(
  markdownContent: string,
  outputDir: string,
  baseFileName: string = "code_block"
): Promise<CodeUnifiedInfo[]> {
  await fs.mkdir(outputDir, { recursive: true });

  const blocks = extractMarkdownCodeBlocks(markdownContent);

  const createdFiles: CodeUnifiedInfo[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const { language, content } = blocks[i];

    let ext = ".txt";
    if (language && LANG_EXT_MAP[language]) {
      ext = LANG_EXT_MAP[language];
    }

    const fileName = `${baseFileName}`;
    const filePath = path.join(outputDir, fileName);

    try {
      await fs.writeFile(filePath, content);
      createdFiles.push({
        path: filePath,
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
 * Extracts the folder and file name from a string containing a file path.
 *
 * It looks for patterns like "folder/subfolder/file.ext" or "folder/file.ext".
 * If multiple paths exist, it prioritizes the last one found (common in sentences like "check A and then B").
 *
 * @param text - The input string (e.g., from a commit message or LLM response)
 * @returns An object with 'folder' and 'file', or null if no valid path is found.
 */
export function extractFileAndFolderFromText(
  text: string
): PathExtractionResult | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // Regex Explanation:
  // #                : Matches the opening hash
  // ([\w\-\.\/]+?)   : Capture Group 1 (The full relative path).
  //                    Non-greedy match for word chars, hyphens, dots, and slashes.
  // #                : Matches the closing hash
  const regex = /#([\w\-\.\/]+?)#/;

  const match = text.match(regex);

  if (!match || !match[1]) {
    return null;
  }

  const fullPath = match[1];

  // Find the last slash to separate folder and file
  const lastSlashIndex = fullPath.lastIndexOf("/");

  if (lastSlashIndex === -1) {
    // No folder found, it's just a filename
    return {
      folder: "",
      file: fullPath,
    };
  }

  // Split into folder and file
  const folder = fullPath.substring(0, lastSlashIndex);
  const file = fullPath.substring(lastSlashIndex + 1);

  // Basic validation: ensure file has an extension (optional but recommended)
  if (!file.includes(".")) {
    // Depending on requirements, you might still want to return it,
    // but usually files have extensions.
    // return null;
  }

  return {
    folder: folder,
    file: file,
  };
}
