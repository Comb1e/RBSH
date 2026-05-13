import { ToolRegistry } from "@/types/index.js";
import {
  createFileWithDirectoriesTool,
  readFileToolDefinition,
} from "./scripts/index.js";

export const generatorToolRegistry: ToolRegistry = {
  createFileWithDirectories: createFileWithDirectoriesTool,
  readFile: readFileToolDefinition,
};
