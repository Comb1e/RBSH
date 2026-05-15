import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
import { fileURLToPath } from "node:url";
import { CreateFileOptions, ToolDefinition } from "@/types/index.js";
import { createFileWithDirectoriesSchema } from "@/schemas/index.js";
import { getExecuteDefaultCwd } from "./exec.js";

const __filename = fileURLToPath(import.meta.url);
const __dirnameVal = dirname(__filename);
const PROJECT_ROOT = resolve(__dirnameVal, "..", "..");

function getBaseDir(): string {
  return getExecuteDefaultCwd() ?? PROJECT_ROOT;
}

/**
 * Creates a file at the specified path, automatically creating any missing parent
 * directories. Refuses to write outside the allowed base directory.
 */
export async function createFileWithDirectories(
  filePath: string,
  content: string | Buffer | Uint8Array,
  options: CreateFileOptions = {}
): Promise<string> {
  if (!filePath || typeof filePath !== "string") {
    throw new TypeError("Invalid file path: a non-empty string is required.");
  }

  const baseDir = getBaseDir();
  const absolutePath = resolve(baseDir, filePath);

  // Path traversal protection — accept any path under the base directory
  if (
    absolutePath !== baseDir &&
    !absolutePath.startsWith(baseDir + sep)
  ) {
    throw new Error(
      `Path traversal denied: "${filePath}" resolves outside allowed directory "${baseDir}".`
    );
  }

  const parentDir = dirname(absolutePath);
  const { overwrite = true, encoding = "utf8", mode = 0o644 } = options;

  try {
    await mkdir(parentDir, { recursive: true, mode });
  } catch (error: any) {
    throw new Error(
      `Failed to create directory tree '${parentDir}': ${error.message}`
    );
  }

  try {
    const flag = overwrite ? "w" : "wx";
    await writeFile(absolutePath, content, { encoding, flag, mode });
    return "File created successfully at: " + absolutePath;
  } catch (error: any) {
    if (!overwrite && error.code === "EEXIST") {
      throw new Error(
        `File already exists at '${absolutePath}' and overwrite is disabled.`
      );
    }
    throw new Error(`Failed to write file '${absolutePath}': ${error.message}`);
  }
}

export const createFileWithDirectoriesTool: ToolDefinition<
  typeof createFileWithDirectoriesSchema
> = {
  name: "createFileWithDirectories",
  description:
    "Creates a file at the specified path, automatically creating any missing parent directories.",
  schema: createFileWithDirectoriesSchema,
  execute: async (args) => {
    if (!args) {
      throw new Error("createFileWithDirectories: args is required.");
    }

    console.log(`[createFileWithDirectories] ${args.filePath}`);

    // Decode base64 content (case-insensitive prefix)
    const base64Match = args.content.match(/^base64:(.+)$/i);
    const finalContent = base64Match
      ? Buffer.from(base64Match[1], "base64")
      : args.content;

    const encoding = args.options?.encoding ?? "utf8";
    const mode = args.options?.mode ?? 0o644;
    const overwrite = args.options?.overwrite ?? true;

    try {
      const result = await createFileWithDirectories(
        args.filePath,
        finalContent as string | Buffer,
        { encoding, mode, overwrite }
      );
      console.log(`[createFileWithDirectories] Created ${args.filePath}`);
      return result;
    } catch (err) {
      console.log(
        `[createFileWithDirectories] FAILED: ${args.filePath} — ${(err as Error).message}`
      );
      throw err;
    }
  },
};
