import { env } from "../config/env.js";
import { OpenAIProvider } from "../providers/openai.js";
import { LLMProvider } from "@/types/index.js";

/**
 * Factory function to create LLM provider instance based on runtime configuration.
 * Supports environment variable defaults + per-call overrides.
 */
export function createProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case "openai":
      return new OpenAIProvider();

    default:
      throw new Error(`Unsupported LLM provider: ${env.LLM_PROVIDER}`);
  }
}
