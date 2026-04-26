import OpenAI from "openai";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import {
  LLMProvider,
  LLMCompletionResult,
  UnifiedToolCall,
  AgentMessage,
} from "@/types/index.js";
import { env } from "../config/env.js";

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
    tools: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<LLMCompletionResult> {
    try {
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        Array.isArray(agentMessages)
          ? agentMessages.map((msg) => {
              const base = {
                role: msg.role as any,
                content: msg.content,
              };

              if (msg.role === "assistant" && (msg as any).tool_calls) {
                return {
                  ...base,
                  tool_calls: (msg as any).tool_calls,
                } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
              }

              if (msg.role === "tool" && msg.tool_call_id) {
                return {
                  ...base,
                  tool_call_id: msg.tool_call_id,
                } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam;
              }

              return base as
                | OpenAI.Chat.Completions.ChatCompletionUserMessageParam
                | OpenAI.Chat.Completions.ChatCompletionSystemMessageParam;
            })
          : [];
      let stream;
      stream = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: openaiMessages,
        temperature: env.AGENT_TEMPERATURE,
        stream: true,
        tools: tools,
      });
      let unifiedToolCalls: Record<number, UnifiedToolCall> = {};
      let currentMessage: string = "";
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const tool_calls = delta?.tool_calls;
        const content = delta?.content;
        if (tool_calls) {
          for (const toolCallChunk of tool_calls) {
            const index = toolCallChunk.index;
            const id = toolCallChunk.id;
            const functionName = toolCallChunk.function?.name;
            const argsFragment = toolCallChunk.function?.arguments;

            if (!unifiedToolCalls[index]) {
              unifiedToolCalls[index] = {
                id: "",
                name: "",
                argStr: "",
              };
            }
            if (id) unifiedToolCalls[index].id = id;
            if (functionName) unifiedToolCalls[index].name = functionName;
            if (argsFragment) {
              unifiedToolCalls[index].argStr += argsFragment;
            }
          }
        }
        if (content) {
          process.stdout.write(content);
          currentMessage += content;
        }
      }
      const openaiToollCalls = convertToOpenAIToolCalls(unifiedToolCalls);
      if (openaiToollCalls.length > 0) {
        agentMessages.push({
          role: "assistant",
          tool_calls: openaiToollCalls,
        });
      } else {
        agentMessages.push({
          role: "assistant",
          content: currentMessage,
          tool_calls: openaiToollCalls,
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
        console.log("Status:", error.status);
        console.log("Error type:", error.type);
        console.log("Error Code:", error.code);
      } else {
        console.error("Unexpected error:", error);
      }
      return {
        content: "ERROR",
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
      arguments: call.argStr,
    },
  }));
}
