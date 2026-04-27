import type {
  LLMProvider,
  AgentCompletionResult,
  UnifiedToolResult,
  AgentMessage,
  ToolDefinition,
} from "@/types/index.js";
import { env } from "../config/env.js";
import { generatorToolRegistry, handleToolExecution } from "@/tools/index.js";
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
    const completion = await provider.complete(
      agentMessages,
      generatorToolRegistry
    );
    agentMessages = completion.messages;
    const content = completion.content;
    const toolCalls = completion?.toolCalls;

    if (content == "") {
      console.log(`[WARN] ${role} returned empty content; retrying...`);
      continue;
    }

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
        name: executed.name,
        content: serializeResult(executed.result),
      }));
      agentMessages.push(...toolMessages);
      allExecution.push(...executionResults);

      executionResults.forEach((res) => {
        console.log(
          `[TOOL ${res.status.toUpperCase()}] ${res.name}:`,
          res.status === "success" ? "OK" : res.result
        );
        if (res.status === "success") {
          const toolUseStr: string = `
            --- Tool Used: ${res.name} ---
            Input: ${res.argStr}
            Output: ${serializeResult(res.result)}
            `.trim();
          evaluatorUseStr.push(toolUseStr);
        }
      });
    }

    const ifComplete: string | null = extractTaskCompleteContent(
      completion.content
    );
    const ifToolCalls: string | null = extractSummarizationContent(
      completion.content
    );
    if (ifComplete) {
      if (ifToolCalls) {
        const summarization = parseMultipleToolResults(ifToolCalls);
        console.log(`\n[INFO] ${role} task completed.`);
        summarizeResults.push(...summarization);
        return {
          content: JSON.stringify(evaluatorUseStr),
          toolSummarization: ifToolCalls,
        };
      } else {
        console.log(`\n[INFO] ${role} task completed without tool calls.`);
        return { content: JSON.stringify(ifComplete) };
      } // should be ifComplete}
    }
  }
  return { content: "[ERROR] Task do not complete in max_iteration." };
}
