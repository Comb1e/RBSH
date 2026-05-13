import { ToolDefinition } from "@/types/index.js";
import { readFileToolDefinition } from "./scripts/index.js";

export const evaluatorToolRegistry: Record<string, ToolDefinition> = {
  readFile: readFileToolDefinition,
};
