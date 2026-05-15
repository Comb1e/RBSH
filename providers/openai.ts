import OpenAI from "openai";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import {
  LLMProvider,
  LLMCompletionResult,
  UnifiedToolCall,
  AgentMessage,
  ToolDefinition,
} from "@/types/index.js";
import { env } from "../config/env.js";
import { generateToolsFromRegistry } from "@/tools/index.js";

function ensureValidJson(s: string): string {
  try {
    JSON.parse(s);
    return s;
  } catch {
    return "{}";
  }
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  async complete(
    agentMessages: AgentMessage[],
    toolsRegistry: Record<string, ToolDefinition>
  ): Promise<LLMCompletionResult> {
    try {
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        Array.isArray(agentMessages)
          ? agentMessages.map((msg) => {
              switch (msg.role) {
                case "assistant": {
                  if (msg.tool_calls && msg.tool_calls.length > 0) {
                    const sanitizedCalls = msg.tool_calls.map((tc) => {
                      if ("function" in tc) {
                        return {
                          ...tc,
                          function: {
                            ...tc.function,
                            arguments: ensureValidJson(tc.function.arguments),
                          },
                        };
                      }
                      return tc;
                    });
                    return {
                      role: "assistant",
                      tool_calls: sanitizedCalls,
                    } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
                  }
                  return {
                    role: "assistant",
                    content: msg.content ?? "",
                  } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
                }
                case "tool": {
                  return {
                    role: "tool",
                    content: msg.content ?? "",
                    tool_call_id: msg.tool_call_id ?? "",
                  } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
                }
                case "system": {
                  return {
                    role: "system",
                    content: msg.content ?? "",
                  } as OpenAI.Chat.Completions.ChatCompletionSystemMessageParam;
                }
                default: {
                  return {
                    role: "user",
                    content: msg.content ?? "",
                  } as OpenAI.Chat.Completions.ChatCompletionUserMessageParam;
                }
              }
            })
          : [];

      const openaiTools = generateToolsFromRegistry(toolsRegistry);

      const stream = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: openaiMessages,
        temperature: env.AGENT_TEMPERATURE,
        stream: env.ENABLE_STREAMING,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      // Handle non-streaming response
      if (!env.ENABLE_STREAMING) {
        const completion = stream as OpenAI.Chat.Completions.ChatCompletion;
        const choice = completion.choices[0];
        const content = choice?.message?.content ?? "";

        if (choice?.message?.tool_calls) {
          const toolCalls: UnifiedToolCall[] = choice.message.tool_calls
            .filter(
              (tc): tc is typeof tc & { function: { name: string; arguments: string } } =>
                "function" in tc
            )
            .map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              argStr: tc.function.arguments,
            }));
          agentMessages.push({
            role: "assistant",
            content: content || null,
            tool_calls: choice.message.tool_calls,
          });
          return { content, messages: agentMessages, toolCalls };
        }

        agentMessages.push({ role: "assistant", content });
        return { content, messages: agentMessages };
      }

      // Streaming response
      const unifiedToolCalls: Record<number, UnifiedToolCall> = {};
      let currentMessage = "";

      for await (const chunk of stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta;
        const tool_calls = delta?.tool_calls;
        const content = delta?.content;

        if (tool_calls) {
          for (const toolCallChunk of tool_calls) {
            const index = toolCallChunk.index;
            if (!unifiedToolCalls[index]) {
              unifiedToolCalls[index] = { id: "", name: "", argStr: "" };
            }
            if (toolCallChunk.id) unifiedToolCalls[index].id = toolCallChunk.id;
            if (toolCallChunk.function?.name)
              unifiedToolCalls[index].name = toolCallChunk.function.name;
            if (toolCallChunk.function?.arguments)
              unifiedToolCalls[index].argStr +=
                toolCallChunk.function.arguments;
          }
        }
        if (content) {
          process.stdout.write(content);
          currentMessage += content;
        }
      }

      const openaiToolCalls = convertToOpenAIToolCalls(unifiedToolCalls);
      if (openaiToolCalls.length > 0) {
        agentMessages.push({
          role: "assistant" as const,
          content: currentMessage || null,
          tool_calls: openaiToolCalls,
        });
      } else {
        agentMessages.push({
          role: "assistant",
          content: currentMessage,
        });
      }

      const toolCallsArray: UnifiedToolCall[] = Object.values(unifiedToolCalls);
      return {
        content: currentMessage,
        messages: agentMessages,
        toolCalls: toolCallsArray,
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.error(
          `[ERROR] OpenAI API error — status: ${error.status}, type: ${error.type}, code: ${error.code}`
        );
      } else {
        console.error("[ERROR] Unexpected provider error:", error);
      }
      // Sanitize any bad tool call JSON in messages before retry
      for (const msg of agentMessages) {
        if (msg.role === "assistant" && msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            if ("function" in tc && tc.function?.arguments) {
              tc.function.arguments = ensureValidJson(tc.function.arguments);
            }
          }
        }
      }
      // Return empty content so the caller can retry
      return {
        content: "",
        messages: agentMessages,
      };
    }
  }
}

function convertToOpenAIToolCalls(
  accumulatedCalls: Record<number, UnifiedToolCall>
): ChatCompletionMessageToolCall[] {
  return Object.values(accumulatedCalls).map((call) => ({
    id: call.id,
    type: "function" as const,
    function: {
      name: call.name,
      arguments: ensureValidJson(call.argStr),
    },
  }));
}
