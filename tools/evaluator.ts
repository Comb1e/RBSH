import { ToolDefinition } from "@/types/index.js";
import { readFileTool } from "./scripts/index.js";

export const evaluatorToolRegistry: Record<string, ToolDefinition> = {
  readFile: readFileTool,
};
