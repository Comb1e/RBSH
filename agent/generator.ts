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
} from "@/types/index.js";
import { runSummarizer } from "./summarizer.js";
import { createGeneratorBaseMessage } from "../prompts/generator.js";
import { env } from "../config/env.js";
import { generatorTools } from "@/tools/generator.js";
import { generatorToolRegistry, handleToolExecution } from "@/tools/index.js";
import { extractTaskCompleteContent, serializeResult } from "@/utils/output.js";
import { extractMarkdownCodeBlocks } from "@/utils/output.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import { ToolAnalysisResultSchema } from "@/schemas/index.js";

export async function runGenerator(
  provider: LLMProvider,
  artifact: HandoffArtifact,
  background: string,
  inputSchemaDescription: string
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
    inputSchemaDescription
  );
  let summarizeResults: ToolAnalysisResult[] = [];
  for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
    const completion = await provider.complete(agentMessages, generatorTools);
    agentMessages = completion.messages;
    const content = completion.content;
    const toolCalls = completion?.toolCalls;

    if (content == "") {
      console.log("[WARN] Generator returned empty content; retrying...");
      continue;
    }

    if (toolCalls) {
      console.log(toolCalls);
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
      executionResults.forEach(async (res) => {
        console.log(
          `[TOOL ${res.status.toUpperCase()}] ${res.name}:`,
          res.status === "success" ? "OK" : res.result
        );
        if (res.status == "success") {
          const summarize = await runSummarizer(
            provider,
            res.toolDescription,
            res.argStr,
            serializeResult(res.result)
          );
          const cleaned = extractMarkdownCodeBlocks(summarize);
          for (const block of cleaned) {
            summarizeResults.push(
              ToolAnalysisResultSchema.parse(JSON.parse(block.content))
            );
          }
        }
      });
    }

    const ifComplete: string | null = extractTaskCompleteContent(
      completion.content
    );
    if (ifComplete) {
      console.log("\n[INFO] Generator task completed.");
      return { content: ifComplete, toolSummarization: summarizeResults };
    }
  }
  return { content: "[ERROR] Task do not complete in max_iteration." };
}
