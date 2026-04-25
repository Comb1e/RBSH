import { ToolAnalysisResult } from "@/schemas/index.js";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { OpenAI } from "openai/client.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Carries state between context-reset sessions. */
export interface HandoffArtifact {
  task: string;
  completedSteps: string[];
  remainingSteps: string[];
  iterationCount: number;
  preToolSummarize: ToolAnalysisResult[];
}

export interface ScoreExtractionResult {
  score: number;
  status: "Pass" | "Fail";
}

export interface UnifiedAgentOptions {
  provider: "openai" | "anthropic"; // Dynamically select LLM provider
  model: string; // Override default model for this call
  tools?: string[]; // Allowlist of tool names to enable
  taskBudget?: number; // Max tokens for this task
  hooks?: {
    PreToolUse?: Array<
      (ctx: { tool_name: string; tool_input: any }) => Promise<any>
    >;
    PostToolUse?: Array<
      (ctx: { tool_name: string; tool_result: any }) => Promise<any>
    >;
  };
  temperature?: number;
  maxIterations?: number;
}

export interface LLMProvider {
  complete(
    message: AgentMessage[],
    tools: OpenAI.Chat.ChatCompletionTool[]
  ): Promise<LLMCompletionResult>; // Call LLM
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ChatCompletionMessageToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  argStr: string;
}

export interface LLMCompletionResult {
  content: string;
  messages: AgentMessage[];
  toolCalls?: UnifiedToolCall[];
}

export interface GeneratorCompletionResult {
  content: string;
  toolSummarization?: ToolAnalysisResult[];
}

export interface SkillMetadata {
  name: string;
  description: string;
  func: string[];
}

export interface GeneratorEvaluatorLoopCompletion {
  content: string;
  toolSummarization?: ToolAnalysisResult[];
}
