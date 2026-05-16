import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import {
  createFileWithDirectoriesTool,
  replaceInFileToolDefinition,
} from "./scripts/index.js";

export const modifierToolRegistry: ToolRegistry = {
  ...commonTools,
  createFileWithDirectories: createFileWithDirectoriesTool,
  replaceInFile: replaceInFileToolDefinition,
};
