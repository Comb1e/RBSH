import * as fs from "fs/promises";
import * as path from "path";

/**
 * Maps language identifiers to file extensions.
 * Add more mappings as needed.
 */
const LANG_EXT_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  javascript: ".js",
  js: ".js",
  typescript: ".ts",
  ts: ".ts",
  jsx: ".jsx",
  tsx: ".tsx",

  // Python
  python: ".py",
  py: ".py",

  // Java
  java: ".java",

  // C/C++
  c: ".c",
  cpp: ".cpp",
  cplusplus: ".cpp",
  h: ".h",
  hpp: ".hpp",

  // Go
  go: ".go",
  golang: ".go",

  // Rust
  rust: ".rs",

  // Web
  html: ".html",
  css: ".css",
  scss: ".scss",
  less: ".less",

  // Data/Config
  json: ".json",
  yaml: ".yaml",
  yml: ".yml",
  xml: ".xml",
  sql: ".sql",
  csv: ".csv",

  // Shell
  bash: ".sh",
  sh: ".sh",
  zsh: ".zsh",
  shell: ".sh",

  // Others
  markdown: ".md",
  md: ".md",
  txt: ".txt",
  plaintext: ".txt",
};

/**
 * Extracts code blocks from a Markdown string and saves them as files.
 *
 * @param markdownContent - The input string containing Markdown code blocks.
 * @param outputDir - The directory where files will be saved.
 * @param baseFileName - Optional base name for generated files (e.g., "script").
 *                       Files will be named "script_1.py", "script_2.ts", etc.
 * @returns An array of paths to the created files.
 */
export async function saveMarkdownCodeBlocksToFile(
  markdownContent: string,
  outputDir: string,
  baseFileName: string = "code_block"
): Promise<string[]> {
  // 1. Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // 2. Regex to match code blocks: ```language ... content ... ```
  // Flags: g (global), s (dotAll - allows . to match newlines)
  const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;

  const createdFiles: string[] = [];
  let match;
  let blockIndex = 1;

  // 3. Iterate through all matches
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    const langIdentifier = match[1]?.toLowerCase() || ""; // e.g., "python", "ts"
    const codeContent = match[2]; // The actual code inside the block

    // Determine file extension
    let ext = ".txt"; // Default fallback
    if (langIdentifier && LANG_EXT_MAP[langIdentifier]) {
      ext = LANG_EXT_MAP[langIdentifier];
    } else if (langIdentifier) {
      // If language is known but not in map, you might want to log a warning
      // console.warn(`Unknown language identifier: ${langIdentifier}. Using .txt`);
    }

    // Generate filename
    const fileName = `${baseFileName}_${blockIndex}${ext}`;
    const filePath = path.join(outputDir, fileName);

    try {
      // Write file
      await fs.writeFile(filePath, codeContent.trim());
      createdFiles.push(filePath);
      console.log(`✅ Saved: ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to save ${filePath}:`, error);
    }

    blockIndex++;
  }

  if (createdFiles.length === 0) {
    console.log("⚠️ No code blocks found in the provided Markdown string.");
  }

  return createdFiles;
}

/*
// --- Usage Example ---
(async () => {
  const markdownInput = `
Here is some Python code:
\`\`\`python
def hello():
    print("Hello World")
\`\`\`

And here is some TypeScript:
\`\`\`typescript
interface User {
  id: number;
  name: string;
}
\`\`\`

And a shell script:
\`\`\`bash
echo "Done"
\`\`\`
  `;

  const outputDirectory = "./extracted_code";

  try {
    const files = await saveMarkdownCodeBlocksToFile(
      markdownInput,
      outputDirectory,
      "snippet"
    );
    console.log("\nAll files saved:", files);
  } catch (err) {
    console.error("Error:", err);
  }
})();
*/
