import { readFilesFromRecord } from "./get_params.js";
import * as readline from "readline";

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
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

export function checkCommond(command: string): string {
  if (command === "q") {
    rl.close();
    return "quit";
  } else if (command === "e") {
    console.log("[INFO] Switching to execution mode...");
    return "excute";
  } else if (command === "new") {
    return "new";
  } else if (command === "add" || command.startsWith("--add")) {
    return "add";
  }
  return "";
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
