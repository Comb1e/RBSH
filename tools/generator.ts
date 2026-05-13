import { ToolRegistry } from "@/types/index.js";
import { commonTools } from "./tools.js";
import { createFileWithDirectoriesTool } from "./scripts/index.js";

export const generatorToolRegistry: ToolRegistry = {
  ...commonTools,
  createFileWithDirectories: createFileWithDirectoriesTool,
};
