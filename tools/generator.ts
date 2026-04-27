import { ToolDefinition } from "@/types/index.js";
import {
  createFileWithDirectoriesTool,
  readFileTool,
} from "./scripts/index.js";

export const generatorToolRegistry: Record<string, ToolDefinition> = {
  createFileWithDirectories: createFileWithDirectoriesTool,
  readFile: readFileTool,
};
