import { readFile } from "fs/promises";
import fs from "fs/promises";
import yaml from "js-yaml";
import path from "path";
import type { SkillMetadata, ScoreExtractionResult } from "@/types/index.js";
import { __dirname } from "@/config/env.js";
import { parseExcelSchemaToFile } from "./read_excel.js";

export async function getFile(targetPath: string): Promise<string> {
  let file: Promise<string> = Promise.resolve("");
  try {
    file = readFile(targetPath, "utf-8");
  } catch (error) {
    console.error("[ERROR] Read file error", (error as Error).message);
    console.error("[ERROR] Target path:", targetPath);
  }
  return file;
}

export async function readFilesFromRecord(
  fileMap: Record<string, string[]>
): Promise<string[]> {
  const entries = Object.entries(fileMap);
  // Create a flat array of promises for all files
  const promises = entries.flatMap(([key, values]) => {
    return values.map((value) => {
      const filePath = path.join(__dirname, key, value);
      return getFile(filePath);
    });
  });

  const contents = await Promise.all(promises);
  return contents;
}

/**
 * Reads contents from multiple files specified by an array of paths.
 *
 * @param filePaths - An array of file paths (relative to __dirname or absolute)
 * @returns A promise resolving to an array of file contents (strings)
 */
export async function readFilesFromList(
  filePaths: string[]
): Promise<string[]> {
  // Map each path to a promise that reads the file content
  const promises = filePaths.map(async (filePath) => {
    // If filePaths are relative to the current module's directory:
    const resolvedPath = path.join(__dirname, filePath);

    // If filePaths are already absolute, use filePath directly instead:
    // const resolvedPath = filePath;

    return getFile(resolvedPath);
  });

  // Wait for all files to be read in parallel
  const contents = await Promise.all(promises);

  return contents;
}

export async function getSubDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    return directories;
  } catch (error) {
    console.error(`[ERROR] Read Folder failed: ${dirPath}`, error);
    return [];
  }
}

/**
 * Recursively reads all file paths in a given directory, including subdirectories.
 * @param dirPath - The root directory path to read.
 * @returns A promise resolving to an array of absolute file paths.
 */
async function getAllFiles(dirPath: string): Promise<string[]> {
  const filesList: string[] = [];

  try {
    // 1. Read all entries in the current directory
    // withFileTypes: true allows us to check if an entry is a file or directory without extra stat calls
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // 2. Iterate over each entry
    for (const entry of entries) {
      const fullPath = path.resolve(dirPath, entry.name);

      if (entry.isDirectory()) {
        // 3. If it's a directory, recurse into it
        const subFiles = await getAllFiles(fullPath);
        filesList.push(...subFiles);
      } else if (entry.isFile()) {
        // 4. If it's a file, add it to the list
        filesList.push(fullPath);
      }
      // Note: Symbolic links and other types are ignored here.
      // Add entry.isSymbolicLink() checks if needed.
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    throw error; // Or return [] depending on your error handling strategy
  }

  return filesList;
}

/**
 * Main preprocessing function to read all Excel files from input_raw
 * and generate schema JSON files.
 *
 * @param inputDir - The directory containing raw files (e.g., './input_raw')
 * @param outputDir - The directory to save generated schemas (e.g., './output_schemas')
 */
export async function dataPreprocess(
  inputDir: string,
  outputDir: string
): Promise<string[]> {
  console.log(`[INFO] Starting preprocessing for directory: ${inputDir}`);
  let schemasPath: string[] = [];

  try {
    // 1. Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // 2. Retrieve all file paths recursively
    const allFiles = await getAllFiles(inputDir);

    // 3. Filter for Excel files (.xlsx and .xls)
    const excelFiles = allFiles.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".xlsx" || ext === ".xls";
    });

    if (excelFiles.length === 0) {
      console.log("[INFO] No Excel files found in the input directory.");
      return [];
    }

    console.log(`[INFO] Found ${excelFiles.length} Excel files. Processing...`);

    // 4. Process each Excel file in parallel
    const processingPromises = excelFiles.map(async (filePath) => {
      try {
        // Construct the output file path
        // Strategy: Flatten output (all JSONs in the root of outputDir)
        // Example: report.xlsx -> report-schema.json
        const fileName = path.basename(filePath, path.extname(filePath));
        const outputJsonPath = path.join(outputDir, `${fileName}-schema.json`);
        schemasPath.push(outputJsonPath);

        // Alternative Strategy: Preserve directory structure
        // Uncomment the following lines if you have duplicate filenames in different subfolders
        /*
        const relativePath = path.relative(inputDir, filePath);
        const relativeDir = path.dirname(relativePath);
        const outputJsonPath = path.join(outputDir, relativeDir, `${fileName}-schema.json`);
        await fs.mkdir(path.dirname(outputJsonPath), { recursive: true });
        */

        console.log(`[INFO] Processing: ${filePath}`);

        // Call the existing schema parsing function
        await parseExcelSchemaToFile(filePath, outputJsonPath);

        console.log(`[INFO] Success: ${outputJsonPath}`);
        return { file: filePath, status: "success" };
      } catch (error) {
        console.error(`[ERROR] Failed to process ${filePath}:`, error);
        return { file: filePath, status: "failed", error };
      }
    });

    // Wait for all tasks to complete
    const results = await Promise.all(processingPromises);

    // 5. Summarize results
    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "failed").length;

    console.log(`\n🎉 Preprocessing Complete.`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
  } catch (error) {
    console.error("💥 Critical error during preprocessing:", error);
    throw error;
  }
  return schemasPath;
}

function parseFrontmatter(content: string): SkillMetadata {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  const metadata: SkillMetadata = {
    name: "Unnamed Skill",
    description: "No description provided.",
    func: [],
  };
  if (!match) {
    return metadata;
  }

  try {
    const meta = yaml.load(match[1]) as any;
    metadata.name = meta.name || "Unnamed Skill";
    metadata.description = meta.description || "No description provided.";
    metadata.func = meta.func || [];
    return metadata;
  } catch (e) {
    console.error("[ERROR] YAML read failed:", e);
    return metadata;
  }
}

export async function loadSkillsMetadata(
  skillsDir: string
): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const subFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    console.log(`[INFO] Find ${subFolders.length} skill folders:`, subFolders);

    for (const folderName of subFolders) {
      const skillPath = path.join(skillsDir, folderName);
      const skillFilePath = path.join(skillPath, "SKILL.md");

      try {
        await fs.access(skillFilePath);
        const content = await fs.readFile(skillFilePath, "utf-8");
        const metadata = parseFrontmatter(content);

        skills.push(metadata);
      } catch (err) {
        console.warn(
          `[WARN] Skip ${folderName}: No SKILL.md found or read failed.`
        );
      }
    }
  } catch (error) {
    console.error(`[ERROR] Read skills root path failed: ${skillsDir}`, error);
  }

  return skills;
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
  const regex = /##\s*Overall\s+Score\s*(\d+(?:\.\d+)?).*?(Pass|Fail)/i;

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
