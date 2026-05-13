import { z } from "zod";

export interface ToolDefinition<T extends z.ZodType<any> = any> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}

export interface UnifiedToolResult {
  toolCallId: string;
  name: string;
  argStr: string;
  toolDescription: string;
  status: "success" | "error";
  result: unknown;
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
