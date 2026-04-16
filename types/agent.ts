// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Carries state between context-reset sessions. */
export interface HandoffArtifact {
  task: string;
  completedSteps: string[];
  remainingSteps: string[];
  currentOutput: string;
  iterationCount: number;
  preMaxOutput: string;
}

/** Evaluator verdict returned after each generator cycle. */
export interface EvaluationResult {
  score: number; // 0-10
  passed: boolean; // true when score >= PASSING_THRESHOLD
  critique: string; // human-readable feedback
  suggestedRevision: string;
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
  complete(unifiedPrompt: UnifiedAgentPrompt): Promise<LLMCompletionResult>; // Call LLM
}

export interface UnifiedAgentPrompt {
  system: string;
  user: string;
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface UnifiedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  execute: (args: Record<string, any>) => Promise<any>;
}

export interface LLMCompletionResult {
  content: string;
  toolCalls?: UnifiedToolCall[];
}

export interface SkillMetadata {
  name: string;
  description: string;
  func: string[];
}
