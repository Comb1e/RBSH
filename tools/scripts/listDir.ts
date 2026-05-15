import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ListDirArgs } from "@/schemas/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

interface DirEntry {
  name: string;
  type: "file" | "directory";
}

interface ListDirResult {
  success: boolean;
  path?: string;
  entries?: DirEntry[];
  count?: number;
  error?: string;
}

async function listDir(args: ListDirArgs): Promise<ListDirResult> {
  try {
    const cleanPath = args.dirPath.replace(/^\/+/, "");
    const resolvedPath = path.resolve(cleanPath);

    // Path traversal protection
    if (
      !resolvedPath.startsWith(PROJECT_ROOT + path.sep) &&
      resolvedPath !== PROJECT_ROOT
    ) {
      return {
        success: false,
        error: `Path traversal denied: "${args.dirPath}" resolves outside project directory.`,
      };
    }

    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        error: `Not a directory: "${args.dirPath}".`,
      };
    }

    const dirents = await fs.readdir(resolvedPath, { withFileTypes: true });
    const entries: DirEntry[] = dirents.map((d) => ({
      name: d.name,
      type: d.isDirectory() ? "directory" : "file",
    }));

    return {
      success: true,
      path: args.dirPath,
      entries,
      count: entries.length,
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === "ENOENT") {
      return { success: false, error: `Directory not found: "${args.dirPath}".` };
    }
    if (err.code === "EACCES") {
      return { success: false, error: `Permission denied: "${args.dirPath}".` };
    }
    return { success: false, error: err.message || "Unknown error." };
  }
}
