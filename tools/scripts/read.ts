import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import type { ReadFileArgs, ReadFileResult } from "@/schemas/index.js";
import { ReadFileArgsSchema, ReadFileResultSchema } from "@/schemas/index.js";
import type { ToolDefinition } from "@/types/index.js";
import { env } from "../../config/env.js";

/** File reads are restricted to paths within the project directory.
 *  Uses file location (not CWD) for robustness regardless of launch directory. */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────────────────────

export async function readFile(args: ReadFileArgs): Promise<ReadFileResult> {
  try {
    // Strip leading slashes (LLMs often produce "/src/file.js" from Unix-style examples)
    const cleanPath = args.filePath.replace(/^\/+/, "");
    const resolvedPath = path.resolve(cleanPath);

    // Path traversal protection
    if (
      !resolvedPath.startsWith(PROJECT_ROOT + path.sep) &&
      resolvedPath !== PROJECT_ROOT
    ) {
      return {
        success: false,
        error: `Path traversal denied: "${args.filePath}" resolves outside project directory.`,
        code: "EPERM",
      };
    }

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
        success: "list_dir_success",
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

    const start = args.startLine || 1;
    const end = args.endLine || Math.min(start + 999, 2000);

    if (start > end) {
      throw new Error("startLine cannot be greater than endLine");
    }

    const lines: string[] = [];
    let currentLine = 0;

    const fileStream = fs.createReadStream(resolvedPath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        currentLine++;
        if (currentLine > end) break;
        if (currentLine >= start) {
          lines.push(line);
        }
      }
    } finally {
      // Always close resources, even on iteration error
      rl.close();
      fileStream.destroy();
    }

    const reachedEOF = currentLine < end;
    const usedDefaults = !args.startLine && !args.endLine;

    // No lines read — file is empty or startLine exceeds file length
    if (currentLine === 0 || currentLine < start) {
      return {
        success: "read_file_success",
        type: "file",
        path: resolvedPath,
        startLine: currentLine === 0 ? 0 : start,
        endLine: currentLine,
        content: "",
        linesReturned: 0,
        note: currentLine === 0
          ? "File is empty."
          : `startLine (${start}) exceeds file length (${currentLine} lines).`,
      };
    }

    return {
      success: "read_file_success",
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
      stack: env.NODE_ENV === "development" ? err.stack : undefined,
    };
  }
}

export const readFileToolDefinition: ToolDefinition<typeof ReadFileArgsSchema> =
  {
    name: "readFile",
    description:
      "Reads file content within a line range to optimize context, or lists directory structure.",
    schema: ReadFileArgsSchema,
    execute: async (args: ReadFileArgs) => {
      const result = await readFile(args);

      if (env.NODE_ENV === "development") {
        ReadFileResultSchema.parse(result);
      }

      return result;
    },
  };
