import { z } from "zod";

export interface ToolDefinition<T extends z.ZodType = any> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<any>;
}

export interface UnifiedToolResult {
  toolCallId: string;
  name: string;
  argStr: string;
  toolDescription: string;
  status: "success" | "error";
  result: unknown;
}

export interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  execute: (args: Record<string, any>) => Promise<any>;
}

export type ToolRegistry = Record<string, ToolDefinition>;

export interface CreateFileOptions {
  /** Whether to overwrite the file if it already exists. Defaults to `true`. */
  overwrite?: boolean;
  /** File encoding. Defaults to `'utf8'`. */
  encoding?: BufferEncoding;
  /** File permission mode (octal). Defaults to `0o644`. */
  mode?: number;
}
