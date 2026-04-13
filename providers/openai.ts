import OpenAI from "openai";
import { LLMProvider, LLMCompletionResult, UnifiedAgentPrompt } from "@/types";
import { env } from "../config/env";
import { tools } from "../tools/weather";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  async complete(prompt: UnifiedAgentPrompt): Promise<LLMCompletionResult> {
    let messages: string = "";
    const systemPrompt = prompt.system ? prompt.system : "";
    const userPrompt = prompt.user ? prompt.user : "";
    try {
      const stream = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: env.AGENT_TEMPERATURE,
        stream: true,
        tools: tools,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        process.stdout.write(content);
        messages += content;
      }
      return {
        content: messages,
      };

      `const choice = res.choices[0];
      const message = choice.message;
      const content = message.content;
      const toolCalls = message.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        return {
          content: content || "",
        };
      }

      for (const toolCall of toolCalls) {
        const { name, arguments: argsStr, id } = toolCall.function;
        const args = JSON.parse(argsStr);
      }

      return {
        content: content || "",
        toolCalls: choice.message?.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
      };`;
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
      };
    }
  }
}
