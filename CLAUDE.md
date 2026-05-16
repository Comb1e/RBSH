# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx tsx main.ts explain project-name         # default: explain data → modify schema → plan → modify plan → execute
npx tsx main.ts explain project-name --add file.xlsx  # preprocess files, then explain
npx tsx main.ts plan project-name            # skip explain, go straight to plan (still reads schema.md if present)
npx tsx main.ts execute project-name         # run harness on existing plan
npx tsc --noEmit                             # type-check only (no emit)
```

There is no test suite or linter configured. `npm start` runs `npx tsx agent.ts` (a standalone agent invocation not related to the main harness flow).

## Architecture

RBSH is a GAN-inspired **harness engineering pipeline**: a Generator produces output while an adversarial Evaluator scores it, looping until the output passes a quality threshold.

### Entry point and REPL (`main.ts`, `utils/input.ts`)

`main.ts` runs a dispatch loop (`explain` → `modify` → `plan` → `modify` → `execute` → `quit`). CLI argument parsing lives in `utils/input.ts:parseCliArgs()` (types in `types/input.ts`). The `--add` flag triggers `dataPreprocess()` to extract schemas from files in `input_raw/` (Excel via `xlsx`, plain text wrapped in JSON envelopes) and write them to `output_schemas/`. Schemas are only loaded from files explicitly added via `--add` — there is no automatic bulk loading.

### Explain phase (`agent/explainer.ts`)

`runExplainer()` produces a data dictionary (`schema.md`) classifying every sheet, column, and cross-sheet relationship in the input data. It runs first in the default workflow so downstream phases (plan, execute) can reference the schema explanation. After writing `schema.md`, the REPL enters modify mode for the user to refine the explanation.

### Plan phase (`agent/plan.ts`, `agent/planner.ts`)

The plan REPL takes user input. First input → `runPlanner()` creates `<PLAN_DOCUMENT>` with four required sections (Project Overview, Technical Stack, Module Division, Development Timeline) written to `./output/<project-name>/plan.md`. The planner receives the explainer's `schema.md` output as context, giving it data understanding before creating the plan. Subsequent inputs → `runModifier()` applies surgical edits to the existing plan.

Special commands in the REPL: `e` (execute), `q` (quit), `p` (proceed to plan phase), `c` (re-run explainer), `add`/`--add <files>` (add input files), `new` (restart).

### Execute phase (`agent/harness.ts`)

`runHarness()` reads the plan file, extracts module steps from `## 3. Module Division` headings, creates `./output/<project-name>/` as the output directory, then runs each step through the Generator↔Evaluator loop. There is no separate comprehension step in the harness — the plan already incorporates schema understanding from the planner phase.

### Generator↔Evaluator loop (`agent/harness.ts:generatorEvaluatorLoop`)

Each step iterates up to `AGENT_MAX_ITERATIONS` times. The Generator produces a draft; the Evaluator scores it. If the score meets `PASSING_THRESHOLD`, the step is accepted. Otherwise the evaluation critique feeds back into the next iteration. After max iterations, the best attempt is returned.

### Agent runtime (`agent/agent.ts`)

`runAgent()` is the shared agent loop used by Generator, Evaluator, and Modifier. It calls the LLM, executes any tool calls returned, feeds tool results back, and repeats until the agent emits a `TASK_COMPLETE` signal or hits `AGENT_MAX_ITERATIONS`. The task-complete signal contains `<SUMMARIZATION>` (JSON array describing tool invocations) and `<TASK_COMPLETE>` (plain-text summary) XML tags.

When the role is `"Generator"` and an output directory is set, `runAgent` performs **auto-verification** before accepting the completion:
1. **Type-check** — runs `npx tsc --noEmit` if `.ts`/`.tsx` files and a `tsconfig.json` are present (skipped otherwise)
2. **Execution** — finds the entry point (preferring `main.*`, `index.*`, etc.) and runs it
If either fails, the error is injected back into the agent messages and the loop continues — the Generator must fix the issue before completing.

### Interactive interrupt (`utils/input.ts`)

Press **`Esc`** during any agent execution (Generator, Evaluator, Explainer, Planner, Modifier) to pause the agent at the next iteration boundary. The terminal prompts `feedback> `:

- Type feedback + Enter → injected as a user message into the agent's message history, agent resumes
- Enter (empty) → resume without changes
- `q` + Enter → abort the agent and return to the REPL

Implementation: `enableInterruptCapture()` sets stdin raw mode and listens for Escape via `readline.emitKeypressEvents()`. `checkForInterrupt()` is called at the top of each agent loop iteration — it suspends raw mode, runs the `input()` prompt, and returns `{ aborted, feedback }`. All agent loops (`runAgent`, `generatorEvaluatorLoop`, `runPlanner`, `runExplainer`) are wrapped in `try { ... } finally { disableInterruptCapture() }` to guarantee stdin is restored. The SIGINT handler also calls `disableInterruptCapture()` before exit. All raw-mode calls are guarded by `process.stdin.isTTY` — the feature is a no-op in CI/piped environments.

### LLM provider (`providers/`)

`createProvider()` returns an `OpenAIProvider` (OpenAI-compatible API, currently pointed at Alibaba DashScope). Config lives in `config/env.ts` — Zod validates all env vars at startup. The `@/*` path alias maps to the project root (see `tsconfig.json` paths).

### Tools (`tools/`)

Each agent role has its own tool registry mapping tool names to Zod-schema-validated implementations. `commonTools` provides `readFile` (reads files / lists directories) to every role.

- **Generator**: `readFile`, `executeCommand`, `createFileWithDirectories` (writes files, creates parent dirs)
- **Evaluator**: `readFile`, `executeCommand` (evaluator inspects files by reading; execution is optional since the Generator already verified)
- **Modifier**: `readFile`, `executeCommand`, `createFileWithDirectories` (reads existing doc, writes modified doc)

`executeCommand` is the general-purpose file modification tool — agents use PowerShell cmdlets (`Get-Content`, `Set-Content`, `Add-Content`, `Select-String`, etc.) on Windows rather than a dedicated replace-in-file tool.

Tool schemas live in `schemas/tools/`. `tools/tools.ts` handles generic tool execution and Zod-to-JSON-Schema conversion for the LLM.

### Input preprocessing (`utils/get_params.ts`)

`dataPreprocess()` finds files in `input_raw/` by name, processes Excel files via `parseExcelSchemaToFile()` (extracts sheet/column schemas using the `xlsx` library), and wraps plain-text files (`.md`, `.txt`, `.csv`, etc.) in JSON envelopes `{ type: "document", fileName, format, content }`. Results are written to `output_schemas/`. When called without `targetFiles`, it processes all supported files.

### Output format contract

The Generator emits two XML-tagged blocks when done:
- `<SUMMARIZATION>[...]</SUMMARIZATION>` — valid JSON array (one object per tool call) describing what was created
- `<TASK_COMPLETE>...</TASK_COMPLETE>` — brief plain-text summary

The Evaluator and Modifier emit a `<TASK_COMPLETE>...</TASK_COMPLETE>` block. The Evaluator's contains `## Overall Score` with a number and `Pass`/`Fail` keyword. `extractOverallScore()` regex-parses this to drive the loop.

Extraction regexes in `utils/output.ts` match XML tags case-insensitively: `/<TASK_COMPLETE>([\s\S]*?)<\/TASK_COMPLETE>/i`.

The Planner emits `<PLAN_DOCUMENT>` with `<FILENAME>` and `<MARKDOWN>` child tags. `plannerParseResponse()` extracts these; `writePlanFile()` sanitizes the filename and writes to disk.

### Skills directory (`skills/`)

Each `skills/*.md` file is a system-prompt fragment loaded at runtime by the prompt builders in `prompts/`. The skill files define agent behavior, output formats, and evaluation rubrics. They are the primary mechanism for adjusting agent behavior — code changes are rarely needed for behavioral tweaks.
