import OpenAI from "openai";
import {
  ToolRegistry,
  UnifiedToolCall,
  UnifiedToolResult,
} from "@/types/index.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileToolDefinition, listDirToolDefinition } from "./scripts/index.js";

/** Maximum allowed size for a single tool call argument string (1MB). */
const MAX_ARG_SIZE = 1024 * 1024;

/** Tools available to every agent role. */
export const commonTools: ToolRegistry = {
  readFile: readFileToolDefinition,
  listDir: listDirToolDefinition,
};

function formatToolSummary(
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): string {
  const resultObj = result as Record<string, unknown> | undefined;
  const status = resultObj?.success === false ? "FAILED" : "OK";
  switch (name) {
    case "readFile": {
      const path = String(args.filePath ?? "?");
      return `read ${path} (${status})`;
    }
    case "listDir": {
      const path = String(args.dirPath ?? "?");
      return `list ${path} (${status})`;
    }
    case "createFileWithDirectories": {
      const path = String(args.filePath ?? "?");
      return `create ${path} (${status})`;
    }
    case "copyFile": {
      const src = String(args.sourcePath ?? "?");
      const dest = String(args.destPath ?? "?");
      return `copy ${src} → ${dest} (${status})`;
    }
    case "executeCommand": {
      const cmd = String(args.command ?? "?");
      const argv = Array.isArray(args.args) ? (args.args as string[]).join(" ") : "";
      const data = (resultObj?.data ?? {}) as Record<string, unknown>;
      const stderrLen = typeof data?.stderr === "string" ? (data.stderr as string).length : 0;
      const diag = data?.diagnostics as { errors?: string[] } | undefined;
      const parts = [`run ${cmd} ${argv} (${status})`.trim()];
      if (stderrLen > 0) parts.push(`stderr:${stderrLen}chars`);
      if (diag?.errors?.length) parts.push(`errors_in_output:${diag.errors.length}`);
      return parts.join(", ");
    }
    default:
      return `${status}`;
  }
}

export function generateToolsFromRegistry(
  toolRegistry: ToolRegistry
): OpenAI.Chat.ChatCompletionTool[] {
  return Object.values(toolRegistry).map((tool) => {
    const jsonSchema = zodToJsonSchema(tool.schema, {
      target: "jsonSchema7",
      $refStrategy: "none",
    });
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema as Record<string, unknown>,
      },
    };
  });
}

export async function handleToolExecution(
  toolCalls: UnifiedToolCall[],
  toolRegistry: ToolRegistry
): Promise<UnifiedToolResult[]> {
  if (!toolCalls || toolCalls.length === 0) return [];

  const results = await Promise.allSettled(
    toolCalls.map(async (call): Promise<UnifiedToolResult> => {
      const toolDef = toolRegistry[call.name];

      if (!toolDef) {
        return {
          toolCallId: call.id,
          name: call.name,
          argStr: call.argStr,
          toolDescription: "",
          status: "error",
          result: `Unknown tool: ${call.name}`,
        };
      }

      try {
        // Input size guard
        if (call.argStr.length > MAX_ARG_SIZE) {
          throw new Error(
            `Tool call arguments exceed ${MAX_ARG_SIZE} byte limit`
          );
        }

        let rawArgs: unknown;
        try {
          rawArgs = JSON.parse(call.argStr);
        } catch {
          throw new Error(`Invalid JSON in argStr for ${call.name}`);
        }

        // Schema validation is required — fail if tool has no schema
        if (!toolDef.schema) {
          throw new Error(`Tool "${call.name}" is missing a validation schema`);
        }
        const validatedArgs = toolDef.schema.parse(rawArgs);
        const output = await toolDef.execute(validatedArgs);

        // Log to terminal so the user can see what the agent is doing
        const summary = formatToolSummary(call.name, validatedArgs, output);
        console.log(`[${call.name}] ${summary}`);

        return {
          toolCallId: call.id,
          name: call.name,
          argStr: call.argStr,
          toolDescription: toolDef.description,
          status: "success",
          result: output,
        };
      } catch (error) {
        return {
          toolCallId: call.id,
          name: call.name,
          argStr: call.argStr,
          toolDescription: toolDef.description,
          status: "error",
          result: (error as Error).message,
        };
      }
    })
  );

  const fulfilled: UnifiedToolResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      fulfilled.push(r.value);
    } else {
      console.error(
        "[ERROR] Tool execution promise rejected unexpectedly:",
        r.reason
      );
    }
  }
  return fulfilled;
}
