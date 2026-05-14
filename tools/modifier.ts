import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import {
  commandToolDefinition,
  createFileWithDirectoriesTool,
  copyFileToolDefinition,
} from "./scripts/index.js";

export const modifierToolRegistry: ToolRegistry = {
  ...commonTools,
  executeCommand: commandToolDefinition,
  createFileWithDirectories: createFileWithDirectoriesTool,
  copyFile: copyFileToolDefinition,
};
