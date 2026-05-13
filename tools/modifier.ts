import { ToolDefinition } from "@/types/index.js";
import {
  commandToolDefinition,
  readFileToolDefinition,
} from "./scripts/index.js";

export const modifierToolRegistry: Record<string, ToolDefinition> = {
  executeCommand: commandToolDefinition,
  readFile: readFileToolDefinition,
};
