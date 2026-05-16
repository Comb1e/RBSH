import { readFilesFromRecord } from "./get_params.js";
import type { Command, CliArgs } from "@/types/input.js";
import * as readline from "readline";

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

process.on("SIGINT", () => {
  console.log("\n[INFO] Exiting...");
  disableInterruptCapture();
  rl.close();
  process.exit(0);
});

export function input(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      resolve(answer);
    });
  });
}

const USER_PROMPT = { prompts: ["user_prompt.md"] };

export async function getUserPromptByCommand(command: string): Promise<string> {
  switch (command) {
    case "r": {
      console.log("[INFO] Reading user prompt from record...");
      const userPromptArray = await readFilesFromRecord(USER_PROMPT);
      return userPromptArray.join("\n");
    }
    default:
      return command;
  }
}

export function checkCommand(command: string): string {
  if (command === "q") {
    rl.close();
    return "quit";
  } else if (command === "e") {
    console.log("[INFO] Switching to execution mode...");
    return "execute";
  } else if (command === "c") {
    console.log("[INFO] Explaining input parameters...");
    return "explain";
  } else if (command === "new") {
    return "new";
  } else if (command === "p") {
    return "plan";
  } else if (command === "add" || command.startsWith("--add")) {
    return "add";
  }
  // Any other text is treated as a modification instruction
  return "modify";
}

/**
 * Extracts file names from an --add command.
 *   "--add report.xlsx notes.md" → ["report.xlsx", "notes.md"]
 *   "add"                      → []  (REPL will prompt interactively)
 */
export function parseAddCommand(command: string): string[] {
  const trimmed = command.trim();
  if (trimmed === "add") return [];

  // Strip leading --add or add prefix
  const rest = trimmed.replace(/^(--add|add)\s*/, "");
  if (!rest) return [];

  return rest
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Interrupt capture (Esc to pause agent) ────────────────────────────────

let interruptRequested = false;
let captureEnabled = false;

const KEYPRESS_HANDLER = (_: unknown, key: { name: string }): void => {
  if (key.name === "escape") {
    interruptRequested = true;
  }
};

export function enableInterruptCapture(): void {
  if (captureEnabled) return;
  if (!process.stdin.isTTY) return;

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", KEYPRESS_HANDLER);
  captureEnabled = true;
}

export function disableInterruptCapture(): void {
  if (!captureEnabled) return;

  process.stdin.removeListener("keypress", KEYPRESS_HANDLER);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  captureEnabled = false;
}

function suspendInterruptCapture(): void {
  process.stdin.removeListener("keypress", KEYPRESS_HANDLER);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

function resumeInterruptCapture(): void {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.on("keypress", KEYPRESS_HANDLER);
}

export interface InterruptResult {
  aborted: boolean;
  feedback: string;
}

export async function checkForInterrupt(): Promise<InterruptResult> {
  if (!interruptRequested) return { aborted: false, feedback: "" };
  interruptRequested = false;

  suspendInterruptCapture();

  console.log(
    '\n[PAUSE] Agent paused. Enter feedback (Enter = continue, "q" = abort):'
  );
  const feedback = await input("feedback> ");

  if (feedback.trim().toLowerCase() === "q") {
    return { aborted: true, feedback: "" };
  }

  resumeInterruptCapture();

  return {
    aborted: false,
    feedback: feedback.trim(),
  };
}

const VALID_COMMANDS: readonly Command[] = ["plan", "execute", "explain"];

// ── CLI parsing ────────────────────────────────────────────────────────────

export function parseCliArgs(raw: string[]): CliArgs {
  const addFiles: string[] = [];
  const positional: string[] = [];

  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "--add") {
      i++;
      while (i < raw.length && !raw[i].startsWith("--")) {
        addFiles.push(raw[i++]);
      }
    } else {
      positional.push(raw[i++]);
    }
  }

  let command: Command;
  let projectName: string | undefined;

  if (
    positional[0] &&
    !(VALID_COMMANDS as readonly string[]).includes(positional[0])
  ) {
    // First positional is not a command — treat as project name, default to explain
    command = "explain";
    projectName = positional[0];
  } else {
    command = (positional[0] || "explain") as Command;
    projectName = positional[1];
  }

  if (!(VALID_COMMANDS as readonly string[]).includes(command)) {
    throw new Error(
      `Unknown command: "${command}". Valid commands: ${VALID_COMMANDS.join(
        ", "
      )}.`
    );
  }

  if (command === "execute" && !projectName) {
    throw new Error(
      `The "execute" command requires a project name.\n` +
        `Usage: npx tsx main.ts execute <project-name> [--add file.xlsx ...]`
    );
  }

  return { command, projectName, addFiles };
}
