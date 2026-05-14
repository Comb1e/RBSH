import * as fs from "node:fs";
import * as path from "node:path";
import type { CopyFileArgs } from "@/schemas/index.js";
import { CopyFileArgsSchema } from "@/schemas/index.js";
import type { ToolDefinition } from "@/types/index.js";

const INPUT_RAW_DIR = path.resolve("./input_raw");
const OUTPUT_DIR = path.resolve("./output");

async function copyFile(args: CopyFileArgs): Promise<{
  success: boolean;
  sourcePath?: string;
  destPath?: string;
  error?: string;
}> {
  try {
    const resolvedSource = path.resolve(INPUT_RAW_DIR, args.sourcePath);
    const resolvedDest = path.resolve(OUTPUT_DIR, args.destPath);

    // Path traversal protection
    if (!resolvedSource.startsWith(INPUT_RAW_DIR + path.sep)) {
      return {
        success: false,
        error: `Source path "${args.sourcePath}" resolves outside input_raw/.`,
      };
    }
    if (!resolvedDest.startsWith(OUTPUT_DIR + path.sep)) {
      return {
        success: false,
        error: `Dest path "${args.destPath}" resolves outside output/.`,
      };
    }

    // Check source exists
    if (!fs.existsSync(resolvedSource)) {
      return {
        success: false,
        error: `Source not found: "${args.sourcePath}" in input_raw/.`,
      };
    }

    // Ensure destination parent directory exists
    const destDir = path.dirname(resolvedDest);
    fs.mkdirSync(destDir, { recursive: true });

    // Check overwrite
    if (fs.existsSync(resolvedDest) && !args.overwrite) {
      return {
        success: false,
        error: `Destination already exists: "${args.destPath}". Set overwrite: true to replace.`,
      };
    }

    // Copy (recursive for directories)
    await fs.promises.cp(resolvedSource, resolvedDest, {
      recursive: true,
      force: args.overwrite,
    });

    const stat = fs.statSync(resolvedDest);
    const type = stat.isDirectory() ? "directory" : "file";

    return {
      success: true,
      sourcePath: args.sourcePath,
      destPath: args.destPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export const copyFileToolDefinition: ToolDefinition<typeof CopyFileArgsSchema> = {
  name: "copyFile",
  description:
    "Copy a file or directory from input_raw/ to the output directory. " +
    "Use this to bring raw data files (CSV, Excel, etc.) into the project. " +
    "sourcePath is relative to input_raw/, destPath is relative to output/. " +
    "Directories are copied recursively.",
  schema: CopyFileArgsSchema,
  execute: async (args: CopyFileArgs) => {
    return await copyFile(args);
  },
};
