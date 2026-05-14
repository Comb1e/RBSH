import * as path from "path";
import { createProvider } from "./providers/llm.js";
import { runGenerator, runHarness, plan, runExplainer, runPlanner } from "@/agent/index.js";
import { dataPreprocess, readFilesFromList, readFilesFromRecord, input } from "@/utils/index.js";
import type { PlanResult } from "@/types/index.js";

const INPUT_RAW_DIR = "./input_raw";
const OUTPUT_SCHEMAS_DIR = "./output_schemas";
const OUTPUT_DIR = "./output";

// ── CLI argument types ──────────────────────────────────────────────────────

type Command = "plan" | "execute" | "generate" | "explain";

interface CliArgs {
  command: Command;
  projectName?: string;
  addFiles: string[];
}

const VALID_COMMANDS: readonly Command[] = ["plan", "execute", "generate", "explain"];

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

  let command: Command;
  let projectName: string | undefined;

  if (positional[0] && !(VALID_COMMANDS as readonly string[]).includes(positional[0])) {
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

  if ((command === "plan" || command === "execute" || command === "generate") && !projectName) {
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const r = await readFilesFromList([filePath]);
    return r.length > 0 && r[0].length > 0;
  } catch {
    return false;
  }
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

  // ── Phase detection: skip to appropriate phase if project exists ────────
  if (
    state.workType === "explain" &&
    state.projectDir &&
    cli.addFiles.length === 0
  ) {
    const schemaMdPath = path.join(state.projectDir, "schema.md");
    const planMdPath = path.join(state.projectDir, "plan.md");
    const [hasSchema, hasPlan] = await Promise.all([
      fileExists(schemaMdPath),
      fileExists(planMdPath),
    ]);

    if (hasSchema && hasPlan) {
      console.log(
        `[INFO] Found existing project — resuming at plan modification.`
      );
      state.workType = "modify";
      state.modifyTarget = planMdPath;
    } else if (hasSchema) {
      console.log(
        `[INFO] Found schema.md — resuming at schema modification.`
      );
      state.workType = "modify";
      state.modifyTarget = schemaMdPath;
    }
  }

  // ── REPL loop ──────────────────────────────────────────────────────────

  while (state.workType !== "quit") {
    try {
      switch (state.workType) {
        // ── reset ──────────────────────────────────────────────────────
        case "new":
          state.planPath = "";
          state.projectDir = "";
          state.modifyTarget = "";
          state.workType = "explain";
          break;

        // ── plan / modify ─────────────────────────────────────────────
        case "plan":
        case "modify": {
          const prevWorkType = state.workType;

          // Read schema explanation when entering plan mode
          let schemaExplanation = "";
          if (prevWorkType !== "modify" && state.projectDir) {
            try {
              const sc = await readFilesFromList([
                path.join(state.projectDir, "schema.md"),
              ]);
              schemaExplanation = sc[0] || "";
            } catch {
              /* schema.md not found — continue without */
            }
          }

          const result: PlanResult = await plan(
            provider,
            JSON.stringify(state.inputSchemas),
            state.projectDir,
            prevWorkType === "modify" ? "modify" : undefined,
            prevWorkType === "modify" ? state.modifyTarget : undefined,
            schemaExplanation
          );

          // Auto-plan: when user types 'p' from modify mode, run planner directly
          if (
            result.worktype === "plan" &&
            prevWorkType === "modify" &&
            state.projectDir
          ) {
            let userPrompt = "";
            try {
              const prompts = await readFilesFromRecord({
                prompts: ["user_prompt.md"],
              });
              userPrompt = prompts.join("\n");
              console.log("[INFO] Auto-planning with user_prompt.md ...");
            } catch {
              console.log(
                "[INFO] No user_prompt.md found; using empty prompt."
              );
            }

            let schemaCtx = "";
            try {
              const sc = await readFilesFromList([
                path.join(state.projectDir, "schema.md"),
              ]);
              schemaCtx = sc[0] || "";
            } catch {
              /* ignore */
            }

            const planResult = await runPlanner(
              provider,
              userPrompt,
              JSON.stringify(state.inputSchemas),
              state.projectDir,
              schemaCtx
            );

            if (planResult.planPath) {
              state.planPath = planResult.planPath;
              state.modifyTarget = planResult.planPath;
              state.workType = "modify";
              console.log(`[INFO] Plan created: ${planResult.planPath}`);
            } else {
              console.warn(
                "[WARN] Auto-plan failed. Returning to modify mode."
              );
              state.workType = "modify";
            }
          } else {
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
          }
          break;
        }

        // ── explain ───────────────────────────────────────────────────
        case "explain": {
          // Auto-read user_prompt.md for project context
          let userPrompt = "";
          try {
            const prompts = await readFilesFromRecord({ prompts: ["user_prompt.md"] });
            userPrompt = prompts.join("\n");
            console.log("[INFO] Read user_prompt.md for project context.");
          } catch {
            console.log("[INFO] No user_prompt.md found; continuing without.");
          }

          const result = await runExplainer(
            provider,
            JSON.stringify(state.inputSchemas),
            userPrompt,
            state.projectDir || undefined
          );

          if (result.schemaPath) {
            state.projectDir = result.projectDir || state.projectDir;
            state.planPath = planPathIn(state.projectDir);
            state.modifyTarget = result.schemaPath;
            console.log(`[INFO] Project dir: ${state.projectDir}`);
            console.log(`[INFO] Now modifying: ${result.schemaPath}`);
            state.workType = "modify";
          } else {
            console.warn("[WARN] Explainer failed to produce output.");
            state.workType = "quit";
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
          state.workType = "explain";
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
      state.workType = "explain";
    }
  }
}

await main();
