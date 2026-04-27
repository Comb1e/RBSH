import OpenAI from "openai";
import {
  ToolRegistry,
  UnifiedToolCall,
  UnifiedToolResult,
} from "@/types/index.js";
import { zodToJsonSchema } from "zod-to-json-schema";

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
        let args: any;
        try {
          args = JSON.parse(call.argStr);
        } catch {
          throw new Error(`Invalid JSON in argStr for ${call.name}`);
        }

        const validatedArgs = toolDef.schema?.parse
          ? toolDef.schema.parse(args)
          : args;
        const output = await toolDef.execute(validatedArgs);

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

  return results
    .filter(
      (r): r is PromiseFulfilledResult<UnifiedToolResult> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}
