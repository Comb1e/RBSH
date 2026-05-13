import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { CreateFileOptions, ToolDefinition } from "@/types/index.js";
import { createFileWithDirectoriesSchema } from "@/schemas/index.js";

/** Files must be created within this directory tree. */
const ALLOWED_BASE = resolve("./output");

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

  const absolutePath = resolve(filePath);

  // Path traversal protection
  if (!absolutePath.startsWith(ALLOWED_BASE + "/") && absolutePath !== ALLOWED_BASE) {
    throw new Error(
      `Path traversal denied: "${filePath}" resolves outside allowed directory "${ALLOWED_BASE}".`
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

    // Decode base64 content (case-insensitive prefix)
    const base64Match = args.content.match(/^base64:(.+)$/i);
    const finalContent = base64Match
      ? Buffer.from(base64Match[1], "base64")
      : args.content;

    const encoding = args.options?.encoding ?? "utf8";
    const mode = args.options?.mode ?? 0o644;
    const overwrite = args.options?.overwrite ?? true;

    return createFileWithDirectories(args.filePath, finalContent as any, {
      encoding,
      mode,
      overwrite,
    });
  },
};
