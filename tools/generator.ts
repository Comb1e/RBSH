import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import {
  createFileWithDirectoriesTool,
  commandToolDefinition,
  replaceInFileToolDefinition,
} from "./scripts/index.js";

export const generatorToolRegistry: ToolRegistry = {
  ...commonTools,
  createFileWithDirectories: createFileWithDirectoriesTool,
  replaceInFile: replaceInFileToolDefinition,
};
