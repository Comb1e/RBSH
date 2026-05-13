import fs from "fs/promises";
import yaml from "js-yaml";
import path from "path";
import type { SkillMetadata } from "@/types/index.js";
import { __dirname } from "@/config/env.js";
import { parseExcelSchemaToFile } from "./read_excel.js";

export async function getFile(targetPath: string): Promise<string> {
  try {
    return await fs.readFile(targetPath, "utf-8");
  } catch (error) {
    console.error("[ERROR] Read file error", (error as Error).message);
    console.error("[ERROR] Target path:", targetPath);
    return "";
  }
}

export async function readFilesFromRecord(
  fileMap: Record<string, string[]>
): Promise<string[]> {
  const entries = Object.entries(fileMap);
  const promises = entries.flatMap(([key, values]) => {
    return values.map((value) => {
      // Reject path traversal in key or value segments
      const safeKey = path.basename(key);
      const safeValue = path.basename(value);
      const filePath = path.join(__dirname, safeKey, safeValue);
      return getFile(filePath);
    });
  });

  const contents = await Promise.all(promises);
  return contents;
}

/**
 * Reads contents from multiple files specified by an array of paths.
 * Handles both absolute paths and paths relative to the project root.
 *
 * @param filePaths - An array of file paths (absolute, or relative to project root)
 * @returns A promise resolving to an array of file contents (strings)
 */
export async function readFilesFromList(
  filePaths: string[]
): Promise<string[]> {
  const promises = filePaths.map(async (filePath) => {
    // If already absolute, use directly; otherwise resolve relative to project root
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(__dirname, filePath);
    return getFile(resolvedPath);
  });

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
export async function getAllFiles(dirPath: string): Promise<string[]> {
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
 * Supported file extensions for plain-text documents.
 * These are read verbatim and wrapped in an agent-friendly JSON envelope.
 */
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".rst",
  ".csv",
  ".tsv",
  ".log",
]);

/**
 * Supported file extensions for Excel workbooks.
 */
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);

/**
 * Reads a plain-text file and writes an agent-friendly JSON envelope alongside.
 * Returns the path to the generated JSON file.
 */
async function processTextFile(
  filePath: string,
  outputDir: string
): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  const baseName = path.basename(filePath, path.extname(filePath));
  const outputPath = path.join(outputDir, `${baseName}-document.json`);

  const envelope = {
    type: "document",
    fileName: path.basename(filePath),
    filePath: filePath,
    format: path.extname(filePath).replace(".", ""),
    content: content,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(envelope, null, 2), "utf-8");
  return outputPath;
}

/**
 * Finds a file by name within a directory tree.
 * Returns the first matching absolute path, or null if not found.
 */
async function findFileByName(
  dirPath: string,
  targetName: string
): Promise<string | null> {
  const allFiles = await getAllFiles(dirPath);
  const matches = allFiles.filter(
    (f) => path.basename(f) === targetName
  );
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Main preprocessing function. Reads Excel files (and optionally plain-text
 * documents) from inputDir, generates schema JSON files in outputDir.
 *
 * When `targetFiles` is provided, only those file names are searched for and
 * processed. Otherwise all supported files in inputDir are processed.
 *
 * @param inputDir    - The directory containing raw files (e.g., './input_raw')
 * @param outputDir   - The directory to save generated schemas (e.g., './output_schemas')
 * @param targetFiles - Optional list of specific file names to process
 * @returns Array of absolute paths to the generated schema/document JSON files
 */
export async function dataPreprocess(
  inputDir: string,
  outputDir: string,
  targetFiles?: string[]
): Promise<string[]> {
  const schemasPath: string[] = [];

  try {
    await fs.mkdir(outputDir, { recursive: true });

    // Determine which files to process
    let filesToProcess: string[];

    if (targetFiles && targetFiles.length > 0) {
      // --add mode: find specific files by name
      console.log(
        `[INFO] Looking for ${targetFiles.length} specified file(s) in: ${inputDir}`
      );
      const resolved: string[] = [];
      for (const name of targetFiles) {
        const found = await findFileByName(inputDir, name);
        if (found) {
          resolved.push(found);
          console.log(`[INFO]   Found: ${name} → ${found}`);
        } else {
          console.warn(`[WARN]   Not found: ${name}`);
        }
      }
      filesToProcess = resolved;
    } else {
      // Full scan: all supported files
      console.log(`[INFO] Starting preprocessing for directory: ${inputDir}`);
      const allFiles = await getAllFiles(inputDir);
      filesToProcess = allFiles.filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return EXCEL_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(ext);
      });
    }

    if (filesToProcess.length === 0) {
      console.log("[INFO] No supported files found to process.");
      return [];
    }

    console.log(`[INFO] Found ${filesToProcess.length} file(s). Processing...`);

    // Process each file in parallel
    const processingPromises = filesToProcess.map(async (filePath) => {
      try {
        const ext = path.extname(filePath).toLowerCase();
        const baseName = path.basename(filePath, ext);

        if (EXCEL_EXTENSIONS.has(ext)) {
          const outputJsonPath = path.join(outputDir, `${baseName}-schema.json`);
          await parseExcelSchemaToFile(filePath, outputJsonPath);
          console.log(`[INFO]   Excel schema: ${outputJsonPath}`);
          return { file: filePath, output: outputJsonPath, status: "success" };
        } else if (TEXT_EXTENSIONS.has(ext)) {
          const outputJsonPath = await processTextFile(filePath, outputDir);
          console.log(`[INFO]   Text document: ${outputJsonPath}`);
          return { file: filePath, output: outputJsonPath, status: "success" };
        }

        return { file: filePath, output: "", status: "skipped" };
      } catch (error) {
        console.error(`[ERROR] Failed to process ${filePath}:`, error);
        return { file: filePath, output: "", status: "failed", error };
      }
    });

    const results = await Promise.all(processingPromises);

    // Collect output paths from successful runs
    for (const r of results) {
      if (r.status === "success" && r.output) {
        schemasPath.push(r.output);
      }
    }

    // Summarize
    const successCount = results.filter((r) => r.status === "success").length;
    const failCount = results.filter((r) => r.status === "failed").length;
    const skipCount = results.filter((r) => r.status === "skipped").length;

    console.log(`\n[INFO] Preprocessing Complete.`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    if (skipCount > 0) console.log(`   Skipped: ${skipCount}`);
  } catch (error) {
    console.error("[ERROR] Critical error during preprocessing:", error);
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
