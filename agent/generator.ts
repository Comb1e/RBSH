// ---------------------------------------------------------------------------
// Harness: Generator Agent
// Executes the current step and returns a draft output.
// Context resets happen automatically because each call to query() is a
// fresh session — the handoff artifact carries state forward.
// ---------------------------------------------------------------------------

import type {
  HandoffArtifact,
  LLMProvider,
  GeneratorCompletionResult,
  UnifiedToolResult,
} from "@/types/index.js";
import { createGeneratorBaseMessage } from "../prompts/generator.js";
import { env } from "../config/env.js";
import { generatorToolRegistry, handleToolExecution } from "@/tools/index.js";
import { extractTaskCompleteContent, serializeResult } from "@/utils/output.js";
import { parseMultipleToolResults } from "@/schemas/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";

export async function runGenerator(
  provider: LLMProvider,
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string,
  evaluationStr: string
): Promise<GeneratorCompletionResult> {
  console.log("\n╔══════════════════════════════╗");
  console.log(
    `║  GENERATOR  (iter ${String(artifact.iterationCount).padStart(
      2
    )})        ║`
  );
  console.log("╚══════════════════════════════╝\n");

  let agentMessages = await createGeneratorBaseMessage(
    artifact,
    background,
    inputSchemaDescription,
    evaluationStr
  );
  let summarizeResults: ToolAnalysisResult[] = [];
  let allExecution: UnifiedToolResult[] = [];
  let evaluatorUseStr: string[] = [];
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    console.log(agentMessages);
    const completion = await provider.complete(
      agentMessages,
      generatorToolRegistry
    );
    agentMessages = completion.messages;
    const content = completion.content;
    const toolCalls = completion?.toolCalls;

    if (content == "") {
      console.log("[WARN] Generator returned empty content; retrying...");
      continue;
    }
    if (toolCalls != undefined && toolCalls.length > 0) {
      console.log(
        "\n[INFO] Generator made tool call(s):",
        toolCalls.map((t) => t.name).join(", ")
      );
      const executionResults = await handleToolExecution(
        toolCalls,
        generatorToolRegistry
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
    if (ifComplete) {
      const cleaned = parseMultipleToolResults(ifComplete);
      if (cleaned.length === 0) {
        console.log("\n[INFO] Generator task completed without tool calls.");
        return { content: JSON.stringify(ifComplete) }; // should be ifComplete
      }
      console.log("\n[INFO] Generator task completed.");
      summarizeResults.push(...cleaned);
      return {
        content: JSON.stringify(evaluatorUseStr),
        toolSummarization: summarizeResults,
      };
    }
  }
  return { content: "[ERROR] Task do not complete in max_iteration." };
}
