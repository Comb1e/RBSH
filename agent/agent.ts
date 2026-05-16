import type {
  LLMProvider,
  AgentCompletionResult,
  UnifiedToolResult,
  AgentMessage,
  ToolDefinition,
} from "@/types/index.js";
import { env } from "../config/env.js";
import { handleToolExecution } from "@/tools/index.js";
import { executeCommand, setExecuteDefaultCwd } from "../tools/scripts/exec.js";
import {
  extractTaskCompleteContent,
  extractSummarizationContent,
  serializeResult,
} from "@/utils/output.js";
import { parseMultipleToolResults } from "@/schemas/index.js";
import type { ToolAnalysisResult } from "@/schemas/index.js";
import {
  checkForInterrupt,
  enableInterruptCapture,
  disableInterruptCapture,
} from "@/utils/input.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";

// ── Auto-verification: entry point detection ──────────────────────────────────

const EXECUTABLE_EXTENSIONS: Record<string, string> = {
  ".py": "python",
  ".js": "node",
  ".mjs": "node",
  ".cjs": "node",
  ".ts": "npx",
  ".sh": "bash",
  ".ps1": "powershell",
  ".rb": "ruby",
  ".R": "Rscript",
};

const ENTRY_POINT_PATTERNS = /(^|\/|\\)(main|index|app|server|cli|run)\.[^.]+$/;

function filePathToPythonModule(filePath: string): string {
  return filePath
    .replace(/\.\//, "")
    .replace(/\.py$/, "")
    .replace(/[/\\]/g, ".");
}

function findEntryPoint(
  files: { path: string }[]
): { filePath: string; interpreter: string; args: string[] } | null {
  const executables = files.filter((f) => {
    const ext = path.extname(f.path).toLowerCase();
    return ext in EXECUTABLE_EXTENSIONS;
  });

  if (executables.length === 0) return null;

  const entry =
    executables.find((f) => ENTRY_POINT_PATTERNS.test(f.path)) ??
    executables[0];

  const ext = path.extname(entry.path).toLowerCase();
  const interpreter = EXECUTABLE_EXTENSIONS[ext];

  return {
    filePath: entry.path,
    interpreter,
    args:
      interpreter === "npx"
        ? ["tsx", entry.path]
        : interpreter === "python"
        ? ["-m", filePathToPythonModule(entry.path)]
        : [entry.path],
  };
}

function buildAutoVerifyFailureMessage(
  entryPoint: { filePath: string; interpreter: string; args: string[] },
  result: {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    diagnostics?: { errors: string[] };
  },
  cwd?: string
): string {
  const cwdNote = cwd ? `  (cwd: ${cwd})` : "";
  const lines = [
    "AUTO-VERIFICATION: Your entry point was executed and failed.",
    "",
    `Command: ${entryPoint.interpreter} ${entryPoint.args.join(" ")}${cwdNote}`,
    `Exit code: ${result.exitCode ?? "null (killed/timed out)"}`,
  ];
  if (result.stdout) {
    lines.push("Stdout:", result.stdout.slice(0, 2000));
  }
  if (result.stderr) {
    lines.push("Stderr:", result.stderr.slice(0, 2000));
  }
  if (result.diagnostics?.errors?.length) {
    lines.push("Diagnostics errors:");
    for (const err of result.diagnostics.errors) {
      lines.push(`- ${err}`);
    }
  }
  lines.push(
    "",
    "Fix the errors above. You will NOT be allowed to complete until the entry point runs successfully."
  );
  return lines.join("\n");
}

// ── Auto-verification: type-check ────────────────────────────────────

async function runTypeCheck(
  files: { path: string }[],
  outputDir: string
): Promise<{ passed: boolean; message: string } | null> {
  const hasTypeScript = files.some((f) => {
    const ext = path.extname(f.path).toLowerCase();
    return ext === ".ts" || ext === ".tsx";
  });
  if (!hasTypeScript) {
    console.log(
      "\n[AUTO-VERIFY] No TypeScript files found — skipping type-check."
    );
    return null;
  }

  try {
    await fs.access(path.join(outputDir, "tsconfig.json"));
  } catch {
    console.log(
      "[AUTO-VERIFY] TypeScript files found but no tsconfig.json — skipping type-check."
    );
    return null;
  }

  console.log("[AUTO-VERIFY] Running type-check (npx tsc --noEmit)...");
  try {
    const result = await executeCommand({
      command: "npx",
      args: ["tsc", "--noEmit"],
      cwd: outputDir,
      timeout: 60000,
      shell: false,
      maxBuffer: 10 * 1024 * 1024,
    });

    const passed = result.exitCode === 0 && !result.timedOut;

    if (passed) {
      console.log("[AUTO-VERIFY] Type-check passed.");
      return { passed: true, message: "" };
    }

    const lines = [
      "AUTO-VERIFICATION: Type-check failed.",
      "",
      "Command: npx tsc --noEmit",
      `  (cwd: ${outputDir})`,
      "",
      "Fix the type errors above. You will NOT be allowed to complete until type-check passes.",
    ];
    if (result.stdout) {
      lines.push("", "Stdout:", result.stdout.slice(0, 3000));
    }
    if (result.stderr) {
      lines.push("", "Stderr:", result.stderr.slice(0, 1000));
    }
    return { passed: false, message: lines.join("\n") };
  } catch (err) {
    console.log(
      `[AUTO-VERIFY] Could not run tsc (${
        (err as Error).message
      }) — skipping type-check.`
    );
    return null;
  }
}

export async function runAgent(
  provider: LLMProvider,
  agentMessages: AgentMessage[],
  toolRegistry: Record<string, ToolDefinition>,
  role: string,
  outputDir?: string
): Promise<AgentCompletionResult> {
  if (outputDir) {
    outputDir = path.resolve(outputDir);
    setExecuteDefaultCwd(outputDir);
  }
  let summarizeResults: ToolAnalysisResult[] = [];
  let allExecution: UnifiedToolResult[] = [];
  let evaluatorUseStr: string[] = [];
  enableInterruptCapture();
  try {
    for (let iter = 1; iter <= env.AGENT_MAX_ITERATIONS; iter++) {
      // ── User interrupt checkpoint ────────────────────────────────────
      const interrupt = await checkForInterrupt();
      if (interrupt.aborted) {
        return {
          content:
            "[INTERRUPTED] Agent execution aborted by user feedback request.",
        };
      }
      if (interrupt.feedback) {
        agentMessages.push({ role: "user", content: interrupt.feedback });
        console.log(
          `[INFO] User feedback injected into ${role} message history.`
        );
      }

      // Call Agent
    const completion = await provider.complete(agentMessages, toolRegistry);
    agentMessages = completion.messages;
    const content = completion.content;
    const toolCalls = completion?.toolCalls;

    // Check toolCalls
    if (toolCalls != undefined && toolCalls.length > 0) {
      console.log(`[${role}] ${toolCalls.map((t) => t.name).join(", ")}`);
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
        if (res.status !== "success") {
          console.log(`[TOOL FAIL] ${res.name}: ${res.result}`);
        }
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

          // ── Auto-verification for Generator ──────────────────────────
          if (role === "Generator" && outputDir) {
            const allFiles = summarization.flatMap((s) => s.files ?? []);

            // Type-check before execution — type errors make execution moot.
            const typeCheckResult = await runTypeCheck(allFiles, outputDir);
            if (typeCheckResult && !typeCheckResult.passed) {
              console.log(
                `\n[AUTO-VERIFY] Type-check failed:\n${typeCheckResult.message}\n`
              );
              agentMessages.push({
                role: "user",
                content: typeCheckResult.message,
              });
              continue;
            }

            const entryPoint = findEntryPoint(allFiles);
            if (entryPoint) {
              try {
                const resolvedEntryPath = path.resolve(
                  outputDir,
                  entryPoint.filePath
                );
                const relativePath = path.relative(
                  outputDir,
                  resolvedEntryPath
                );
                const execResult = await executeCommand({
                  command: entryPoint.interpreter,
                  args: entryPoint.args.map((a) =>
                    a === entryPoint.filePath ? relativePath : a
                  ),
                  cwd: outputDir,
                  timeout: 30000,
                  shell: false,
                  maxBuffer: 10 * 1024 * 1024,
                });
                const passed =
                  execResult.exitCode === 0 &&
                  !execResult.timedOut &&
                  (!execResult.diagnostics ||
                    execResult.diagnostics.errors.length === 0);
                if (!passed) {
                  const failMsg = buildAutoVerifyFailureMessage(
                    entryPoint,
                    execResult,
                    outputDir
                  );
                  console.log(
                    `\n[AUTO-VERIFY] Entry point failed (exit ${execResult.exitCode}):\n${failMsg}\n`
                  );
                  agentMessages.push({ role: "user", content: failMsg });
                  continue;
                }
                console.log(
                  `\n[AUTO-VERIFY] Entry point ran successfully (exit 0).`
                );
              } catch (err) {
                console.log(
                  `\n[AUTO-VERIFY] Could not execute entry point: ${
                    (err as Error).message
                  }`
                );
                const failMsg = [
                  "AUTO-VERIFICATION: Could not run your entry point.",
                  "",
                  `Command: ${entryPoint.interpreter} ${entryPoint.args.join(
                    " "
                  )}`,
                  `Error: ${(err as Error).message}`,
                  "",
                  "Fix the issue before declaring TASK_COMPLETE.",
                ].join("\n");
                agentMessages.push({ role: "user", content: failMsg });
                continue;
              }
            }
          }

          console.log(
            `\n[INFO] ${role} task completed (${summarization.length} tool summary(s)).`
          );
          summarizeResults.push(...summarization);
          return {
            content: JSON.stringify(evaluatorUseStr) + "\n\n" + ifComplete,
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
} finally {
  disableInterruptCapture();
}
  return { content: "[ERROR] Task did not complete within max iterations." };
}
