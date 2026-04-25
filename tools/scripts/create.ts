import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { CreateFileOptions } from "@/types/index.js";

/**
 * Creates a file at the specified path, automatically creating any missing parent directories.
 *
 * @param filePath - Absolute or relative path to the target file.
 * @param content - Content to write (string, Buffer, or Uint8Array).
 * @param options - Optional configuration flags.
 * @throws {TypeError} If `filePath` is invalid or empty.
 * @throws {Error} If directory creation or file writing fails.
 */
export async function createFileWithDirectories(
  filePath: string,
  content: string | Buffer | Uint8Array,
  options: CreateFileOptions = {}
): Promise<string> {
  // 1. Input validation
  if (!filePath || typeof filePath !== "string") {
    throw new TypeError("Invalid file path: a non-empty string is required.");
  }

  // Resolve to absolute path to avoid CWD-related surprises
  const absolutePath = resolve(filePath);
  const parentDir = dirname(absolutePath);

  // Apply defaults
  const { overwrite = true, encoding = "utf8", mode = 0o644 } = options;

  // 2. Create parent directories recursively (safe if they already exist)
  try {
    await mkdir(parentDir, { recursive: true, mode });
  } catch (error: any) {
    throw new Error(
      `Failed to create directory tree '${parentDir}': ${error.message}`
    );
  }

  // 3. Write the file
  try {
    // 'wx' flag ensures atomic failure if file exists and overwrite=false
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
