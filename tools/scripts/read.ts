import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline";
import type { ReadFileArgs, ReadFileResult } from "@/schemas/index.js";
import { ReadFileArgsSchema, ReadFileResultSchema } from "@/schemas/index.js";
import type { ToolDefinition } from "@/types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE EXECUTION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reads file content within a specified line range or lists directory structure.
 * Uses streaming to prevent memory/context overflow on large files.
 * Returns a strictly typed result conforming to ReadFileResultSchema.
 */
export async function readFile(args: ReadFileArgs): Promise<ReadFileResult> {
  try {
    const resolvedPath = path.resolve(args.filePath);

    // ─── DIRECTORY LISTING ───────────────────────────────────────────────
    if (args.action === "list_dir") {
      const stat = await fsPromises.stat(resolvedPath);
      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolvedPath}`);
      }

      const entries = await fsPromises.readdir(resolvedPath, {
        withFileTypes: true,
      });
      return {
        success: true,
        type: "directory",
        path: resolvedPath,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        })),
      };
    }

    // ─── FILE READING ────────────────────────────────────────────────────
    const stat = await fsPromises.stat(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a regular file: ${resolvedPath}`);
    }

    // Context protection: default to 1000 lines if no range is provided
    const start = args.startLine ?? 1;
    const end = args.endLine ?? start + 999;

    if (start > end) {
      throw new Error("startLine cannot be greater than endLine");
    }

    const lines: string[] = [];
    let currentLine = 0;

    // Memory-efficient streaming via readline (O(1) memory footprint)
    const fileStream = fs.createReadStream(resolvedPath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      currentLine++;
      if (currentLine > end) break;
      if (currentLine >= start) {
        lines.push(line);
      }
    }

    // Explicit resource cleanup
    rl.close();
    fileStream.destroy();

    const reachedEOF = currentLine < end;
    const usedDefaults = !args.startLine && !args.endLine;

    return {
      success: true,
      type: "file",
      path: resolvedPath,
      startLine: start,
      endLine: currentLine,
      content: lines.join("\n"),
      linesReturned: lines.length,
      warning: usedDefaults
        ? `Read limited to ${lines.length} lines to preserve LLM context. Specify startLine/endLine to read other ranges.`
        : undefined,
      note: reachedEOF
        ? "End of file reached before the specified endLine."
        : undefined,
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    return {
      success: false,
      error: err.message || "Unknown error occurred during file operation",
      code: err.code,
      // Only expose stack traces in development environments
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    };
  }
}

export const readFileTool: ToolDefinition = {
  name: "readFile",
  description:
    "Reads file content within a line range to optimize context, or lists directory structure.",
  schema: ReadFileArgsSchema,
  execute: async (args) => {
    const result = await readFile(args);

    // Optional: Validate output in development
    if (process.env.NODE_ENV === "development") {
      ReadFileResultSchema.parse(result);
    }

    return result;
  },
};
