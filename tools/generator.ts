import { ToolRegistry } from "@/types/index.js";
import {
  createFileWithDirectoriesTool,
  readFileTool,
} from "./scripts/index.js";

export const generatorToolRegistry: ToolRegistry = {
  createFileWithDirectories: createFileWithDirectoriesTool,
  readFile: readFileTool,
};
