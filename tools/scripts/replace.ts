import { readFile, writeFile } from "fs/promises";
import { resolve, sep } from "path";
import { fileURLToPath } from "node:url";
import { dirname } from "path";
import { ToolDefinition } from "@/types/index.js";
import { replaceInFileSchema } from "@/schemas/index.js";
import { getExecuteDefaultCwd } from "./exec.js";

const __filename = fileURLToPath(import.meta.url);
const __dirnameVal = dirname(__filename);
const PROJECT_ROOT = resolve(__dirnameVal, "..", "..");

function getBaseDir(): string {
  return getExecuteDefaultCwd() ?? PROJECT_ROOT;
}

export async function replaceInFile(
  filePath: string,
  old_string: string,
  new_string: string
): Promise<string> {
  if (!filePath || typeof filePath !== "string") {
    throw new TypeError("Invalid file path: a non-empty string is required.");
  }

  const baseDir = getBaseDir();
  const absolutePath = resolve(baseDir, filePath);

  if (
    absolutePath !== baseDir &&
    !absolutePath.startsWith(baseDir + sep)
  ) {
    throw new Error(
      `Path traversal denied: "${filePath}" resolves outside allowed directory "${baseDir}".`
    );
  }

  let content: string;
  try {
    content = await readFile(absolutePath, { encoding: "utf8" });
  } catch (error: any) {
    throw new Error(
      `Failed to read file '${absolutePath}': ${error.message}`
    );
  }

  const occurrences = content.split(old_string).length - 1;

  if (occurrences === 0) {
    throw new Error(
      `old_string not found in file '${filePath}'.`
    );
  }

  if (occurrences > 1) {
    throw new Error(
      `old_string appears ${occurrences} times in '${filePath}', must be unique.`
    );
  }

  const index = content.indexOf(old_string);
  const lineNumber = content.substring(0, index).split("\n").length;

  const newContent = content.replace(old_string, new_string);

  try {
    await writeFile(absolutePath, newContent, { encoding: "utf8" });
  } catch (error: any) {
    throw new Error(
      `Failed to write file '${absolutePath}': ${error.message}`
    );
  }

  return `Replaced text in '${filePath}' at line ${lineNumber}.`;
}

export const replaceInFileToolDefinition: ToolDefinition<
  typeof replaceInFileSchema
> = {
  name: "replaceInFile",
  description:
    "Replaces an exact string in a file. The old_string must appear exactly once in the file. " +
    "Use this for surgical edits — it does literal matching (not regex) with utf8 encoding.",
  schema: replaceInFileSchema,
  execute: async (args) => {
    if (!args) {
      throw new Error("replaceInFile: args is required.");
    }

    console.log(`[replaceInFile] ${args.filePath}`);

    try {
      const result = await replaceInFile(
        args.filePath,
        args.old_string,
        args.new_string
      );
      console.log(`[replaceInFile] Updated ${args.filePath}`);
      return result;
    } catch (err) {
      console.log(
        `[replaceInFile] FAILED: ${args.filePath} — ${(err as Error).message}`
      );
      throw err;
    }
  },
};
