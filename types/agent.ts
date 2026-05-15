import { ToolAnalysisResult } from "@/schemas/index.js";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type { ToolDefinition } from "./tools.js";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Carries state between context-reset sessions. */
export interface HandoffArtifact {
  task: string;
  completedSteps: string[];
  remainingSteps: string[];
  iterationCount: number;
  preToolSummarize: ToolAnalysisResult[]; //ToolAnalysisResult[]
}

export interface ScoreExtractionResult {
  score: number;
  status: "Pass" | "Fail";
}

export interface LLMProvider {
  complete(
    message: AgentMessage[],
    toolsRegistry: Record<string, ToolDefinition>
  ): Promise<LLMCompletionResult>; // Call LLM
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
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

export interface AgentCompletionResult {
  content: string;
  toolSummarization?: ToolAnalysisResult[]; //ToolAnalysisResult[]
}

export interface SkillMetadata {
  name: string;
  description: string;
  func: string[];
}

// Generator
export interface GeneratorEvaluatorLoopCompletion {
  content: string;
  toolSummarization?: ToolAnalysisResult[]; //ToolAnalysisResult[]
}

// Plan
export interface PlanResult {
  planPath: string;
  worktype: string;
  addFiles?: string[];
  projectDir?: string;
}
