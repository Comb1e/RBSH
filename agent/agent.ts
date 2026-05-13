import type {
  LLMProvider,
  AgentCompletionResult,
  UnifiedToolResult,
  AgentMessage,
  ToolDefinition,
} from "@/types/index.js";
import { env } from "../config/env.js";
import { handleToolExecution } from "@/tools/index.js";
import {
  extractTaskCompleteContent,
  extractSummarizationContent,
  serializeResult,
} from "@/utils/output.js";
import { parseMultipleToolResults } from "@/schemas/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";

export async function runAgent(
  provider: LLMProvider,
  agentMessages: AgentMessage[],
  toolRegistry: Record<string, ToolDefinition>,
  role: string
): Promise<AgentCompletionResult> {
  let summarizeResults: ToolAnalysisResult[] = [];
  let allExecution: UnifiedToolResult[] = [];
  let evaluatorUseStr: string[] = [];
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    // Call Agent
    const completion = await provider.complete(agentMessages, toolRegistry);
    agentMessages = completion.messages;
    const content = completion.content;
    const toolCalls = completion?.toolCalls;

    // Check toolCalls
    if (toolCalls != undefined && toolCalls.length > 0) {
      console.log(
        `\n[INFO] ${role} made tool call(s):`,
        toolCalls.map((t) => t.name).join(", ")
      );
      const executionResults = await handleToolExecution(
        toolCalls,
        toolRegistry
      );
      const toolMessages = executionResults.map((executed) => ({
        role: "tool" as const,
        tool_call_id: executed.toolCallId,
        content: serializeResult(executed.result),
      }));
      agentMessages.push(...toolMessages);
      allExecution.push(...executionResults);

      executionResults.forEach((res) => {
        console.log(
          `[TOOL ${res.status.toUpperCase()}] ${res.name}:`,
          res.status === "success" ? "OK" : res.result
        );
        const toolUseStr: string =
          res.status === "success"
            ? `
            --- Tool Used: ${res.name} ---
            Input: ${res.argStr}
            Output: ${serializeResult(res.result)}
            `.trim()
            : `
            --- Tool Failed: ${res.name} ---
            Input: ${res.argStr}
            Error: ${serializeResult(res.result)}
            `.trim();
        evaluatorUseStr.push(toolUseStr);
      });
    } else if (content == "") {
      console.log(`[WARN] ${role} returned empty content; retrying...`);
      continue;
    }

    const ifComplete: string | null = extractTaskCompleteContent(
      completion.content
    );
    if (ifComplete) {
      try {
        const ifToolCalls: string | null = extractSummarizationContent(
          completion.content
        );
        if (ifToolCalls) {
          const summarization = parseMultipleToolResults(ifToolCalls);
          console.log(
            `\n[INFO] ${role} task completed (${summarization.length} tool summary(s)).`
          );
          summarizeResults.push(...summarization);
          return {
            content: JSON.stringify(evaluatorUseStr),
            toolSummarization: summarizeResults,
          };
        } else {
          console.log(`\n[INFO] ${role} task completed without tool calls.`);
          return { content: JSON.stringify(ifComplete) };
        }
      } catch (error) {
        console.warn(
          `[WARN] ${role} SUMMARIZATION extraction failed, treating as plain completion:`,
          (error as Error).message
        );
        return { content: JSON.stringify(ifComplete) };
      }
    }
  }
  return { content: "[ERROR] Task did not complete within max iterations." };
}
