import Anthropic from "@anthropic-ai/sdk";
import {
  LLMProvider,
  LLMCompletionResult,
  UnifiedAgentOptions,
  UnifiedAgentPrompt,
} from "@/types";
import { env } from "../config/env";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private agentOptions: UnifiedAgentOptions;
  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // Resolve final configuration: env defaults → function defaults → call-time overrides

    this.agentOptions = {
      provider: "anthropic",
      model: env.ANTHROPIC_MODEL, // Use provider's default model
      tools: ["Read", "Bash"], // Conservative tool allowlist (security best practice)
      taskBudget: env.TASK_BUDGET, // Default token budget for task planning
      temperature: env.AGENT_TEMPERATURE,
    };
  }

  async complete(prompt: UnifiedAgentPrompt): Promise<LLMCompletionResult> {
    let rawMSG: string = "";
    const userPrompt = prompt.user ? prompt.user : "";
    const systemPrompt = prompt.system ? prompt.system : "";
    const stream = await this.client.messages.create({
      model: this.agentOptions.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    });

    for await (const tokens of stream) {
      console.log(tokens);
      rawMSG += tokens;
    }

    const toolCall: string = "";
    const completionResult: LLMCompletionResult = {
      content: rawMSG,
    };
    return completionResult;
  }
}
