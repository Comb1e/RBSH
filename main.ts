import * as path from "path";
import { createProvider } from "./providers/llm.js";
import { runGenerator, runHarness, plan, runExplainer } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList, input } from "@/utils/index.js";
import type { PlanResult } from "@/types/index.js";

const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";
const OUTPUT_DIR = "./output";

// ── CLI argument types ──────────────────────────────────────────────────────

type Command = "plan" | "execute" | "generate";

interface CliArgs {
  command: Command;
  projectName?: string;
  addFiles: string[];
}

const VALID_COMMANDS: readonly Command[] = ["plan", "execute", "generate"];

// ── CLI parsing ────────────────────────────────────────────────────────────

function parseCliArgs(raw: string[]): CliArgs {
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

  const command = (positional[0] || "plan") as Command;
  const projectName: string | undefined = positional[1];

  if (!(VALID_COMMANDS as readonly string[]).includes(command)) {
    throw new Error(
      `Unknown command: "${command}". Valid commands: ${VALID_COMMANDS.join(
        ", "
      )}.`
    );
  }

  if ((command === "execute" || command === "generate") && !projectName) {
    throw new Error(
      `The "${command}" command requires a project name.\n` +
        `Usage: npx tsx main.ts ${command} <project-name> [--add file.xlsx ...]`
    );
  }

  return { command, projectName, addFiles };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function projectDirFromName(name: string): string {
  return path.join(OUTPUT_DIR, name);
}

function planPathIn(projectDir: string): string {
  return path.join(projectDir, "plan.md");
}

async function resolveSchemaDescription(
  projectDir: string,
  inputSchemas: string[]
): Promise<string> {
  try {
    const sc = await readFilesFromList([path.join(projectDir, "schema.md")]);
    if (sc[0]) return sc[0];
  } catch {
    /* fall back to raw schemas */
  }
  return JSON.stringify(inputSchemas);
}

async function addFiles(
  names: string[],
  existing: string[]
): Promise<string[]> {
  if (names.length === 0) return existing;
  const newPaths = await dataPreprocess(
    INPUT_RAW_DIR,
    OUTPUT_SCHEMAS_DIR,
    names
  );
  const contents = await readFilesFromList(newPaths);
  console.log(
    `[INFO] Added ${contents.length} file(s). Total: ${
      existing.length + contents.length
    }`
  );
  return [...existing, ...contents];
}

// ── REPL state ──────────────────────────────────────────────────────────────

interface ReplState {
  workType: string;
  planPath: string;
  projectDir: string;
  modifyTarget: string;
  inputSchemas: string[];
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));

  // Initialize state from CLI
  const state: ReplState = {
    workType: cli.command,
    planPath: "",
    projectDir: cli.projectName ? projectDirFromName(cli.projectName) : "",
    modifyTarget: "",
    inputSchemas: [],
  };

  if (state.projectDir) {
    state.planPath = planPathIn(state.projectDir);
    console.log(`[INFO] Project: ${state.projectDir}`);
  }

  const provider = createProvider();
  state.inputSchemas = await addFiles(cli.addFiles, []);

  // ── REPL loop ──────────────────────────────────────────────────────────

  while (state.workType !== "quit") {
    try {
      switch (state.workType) {
        // ── reset ──────────────────────────────────────────────────────
        case "new":
          state.planPath = "";
          state.projectDir = "";
          state.modifyTarget = "";
          state.workType = "plan";
          break;

        // ── plan / modify ─────────────────────────────────────────────
        case "plan":
        case "modify": {
          const prevWorkType = state.workType;
          const result: PlanResult = await plan(
            provider,
            JSON.stringify(state.inputSchemas),
            prevWorkType === "modify" ? "modify" : undefined,
            prevWorkType === "modify" ? state.modifyTarget : undefined
          );

          state.workType = result.worktype;
          state.planPath = result.planPath || state.planPath;
          state.projectDir = result.projectDir || state.projectDir;

          if (state.workType === "add" && result.addFiles?.length) {
            state.inputSchemas = await addFiles(
              result.addFiles,
              state.inputSchemas
            );
            state.workType = prevWorkType === "modify" ? "modify" : "plan";
          }
          break;
        }

        // ── explain ───────────────────────────────────────────────────
        case "explain": {
          if (!state.projectDir) {
            console.warn("[WARN] No project directory; run 'plan' first.");
            state.workType = "plan";
          } else {
            const planContents = await readFilesFromList([state.planPath]);
            const schemaPath = await runExplainer(
              provider,
              JSON.stringify(state.inputSchemas),
              planContents[0] || "",
              state.projectDir
            );
            if (schemaPath) {
              state.modifyTarget = schemaPath;
              console.log(`[INFO] Now modifying: ${schemaPath}`);
            }
            state.workType = "modify";
          }
          break;
        }

        // ── execute ───────────────────────────────────────────────────
        case "execute": {
          if (!state.planPath || !state.projectDir) {
            console.warn("[WARN] No plan available.");
            state.workType = "quit";
          } else {
            const schemaDescription = await resolveSchemaDescription(
              state.projectDir,
              state.inputSchemas
            );
            await runHarness(
              provider,
              state.planPath,
              schemaDescription,
              state.projectDir
            );
            state.workType = "quit";
          }
          break;
        }

        // ── generate ──────────────────────────────────────────────────
        case "generate": {
          if (!state.planPath || !state.projectDir) {
            console.warn("[WARN] No plan available.");
            state.workType = "quit";
          } else {
            const schemaDescription = await resolveSchemaDescription(
              state.projectDir,
              state.inputSchemas
            );
            const planContents = await readFilesFromList([state.planPath]);
            const planText = planContents[0];
            await runGenerator(
              provider,
              {
                task: planText,
                completedSteps: [],
                remainingSteps: [],
                preToolSummarize: [],
                iterationCount: 0,
              },
              planText,
              schemaDescription,
              "",
              planText,
              state.projectDir
            );
            state.workType = "quit";
          }
          break;
        }

        // ── add ───────────────────────────────────────────────────────
        case "add": {
          const raw = await input("File name(s) from input_raw/: ");
          const names = raw
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (names.length > 0) {
            state.inputSchemas = await addFiles(names, state.inputSchemas);
          }
          state.workType = "plan";
          break;
        }

        // ── quit ──────────────────────────────────────────────────────
        case "quit":
          return;

        default:
          state.workType = "quit";
      }
    } catch (err) {
      console.error("[ERROR] Unexpected error:", err);
      console.log(
        "[INFO] Continuing REPL — type 'new' to restart or 'q' to quit."
      );
      state.workType = "plan";
    }
  }
}

await main();
