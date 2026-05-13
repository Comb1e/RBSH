import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import {
  commandToolDefinition,
  createFileWithDirectoriesTool,
} from "./scripts/index.js";

export const modifierToolRegistry: ToolRegistry = {
  ...commonTools,
  executeCommand: commandToolDefinition,
  createFileWithDirectories: createFileWithDirectoriesTool,
};
