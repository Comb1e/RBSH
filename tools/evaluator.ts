import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import { commandToolDefinition } from "./scripts/index.js";

export const evaluatorToolRegistry: ToolRegistry = {
  ...commonTools,
  executeCommand: commandToolDefinition,
};
