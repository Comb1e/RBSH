import { env } from "../config/env.js";
import { OpenAIProvider } from "../providers/openai.js";
import { AnthropicProvider } from "../providers/anthropic.js";
import { LLMProvider } from "@/types/index.js";

/**
 * Factory function to create LLM provider instance based on runtime configuration.
 * Supports environment variable defaults + per-call overrides.
 */
export function createProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case "openai":
      return new OpenAIProvider();

    case "anthropic":
      return new AnthropicProvider();

    default:
      throw new Error(`Unsupported LLM provider: ${env.LLM_PROVIDER}`);
  }
}

/**
 * Collects conversation messages by executing an agent loop with dynamic provider selection.
 *
 * @param prompt - Initial user instruction or question
 * @param options - Runtime overrides for provider, tools, hooks, etc.
 * @returns Promise resolving to array of SDK-compatible messages
 *
 * @example
 * // Use default provider (from .env)
 * const msgs = await collectMessages("What's the weather in Tokyo?");
 *
 * // Dynamically switch to Anthropic for complex reasoning
 * const msgs = await collectMessages("Analyze this code...", {
 *   provider: 'anthropic',
 *   tools: ['Read', 'Bash', 'CodeReview']
 * });
 */
