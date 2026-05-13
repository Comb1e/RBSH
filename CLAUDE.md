# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx tsx main.ts plan              # enter plan REPL (create/modify project plans)
npx tsx main.ts excute            # run harness on existing plan
npx tsx main.ts --add file.xlsx plan  # preprocess specific files, then plan
npx tsc --noEmit                  # type-check only (no emit)
```

There is no test suite or linter configured. `npm start` runs `npx tsx agent.ts` (a standalone agent invocation not related to the main harness flow).

## Architecture

RBSH is a GAN-inspired **harness engineering pipeline**: a Generator produces output while an adversarial Evaluator scores it, looping until the output passes a quality threshold.

### Entry point and REPL (`main.ts`)

`main.ts` parses CLI args and runs a dispatch loop (`plan` → `excute`/`generate` → `quit`). The `--add` flag triggers `dataPreprocess()` to extract schemas from files in `input_raw/` (Excel via `xlsx`, plain text wrapped in JSON envelopes) and write them to `output_schemas/`. Schemas are only loaded from files explicitly added via `--add` — there is no automatic bulk loading.

### Plan phase (`agent/plan.ts`, `agent/planner.ts`)

The plan REPL takes user input. First input → `runPlanner()` creates `<PLAN_DOCUMENT>` with four required sections (Project Overview, Technical Stack, Module Division, Development Timeline) written to `./output/plan/<name>-plan.md`. Subsequent inputs → `runModifier()` applies surgical edits to the existing plan. The planner itself comprehends input schemas (no separate comprehension agent) — see `skills/planner.md` for the schema comprehension steps.

Special commands in the REPL: `e` (switch to execute mode), `q` (quit), `add`/`--add <files>` (add input files), `new` (restart plan).

### Execute phase (`agent/harness.ts`)

`runHarness()` reads the plan file, extracts module steps from `## 3. Module Division` headings, creates `./output/<project-name>/` as the output directory, then runs each step through the Generator↔Evaluator loop. There is no separate comprehension step in the harness — the plan already incorporates schema understanding from the planner phase.

### Generator↔Evaluator loop (`agent/harness.ts:generatorEvaluatorLoop`)

Each step iterates up to `AGENT_MAX_ITERATIONS` times. The Generator produces a draft; the Evaluator scores it. If the score meets `PASSING_THRESHOLD`, the step is accepted. Otherwise the evaluation critique feeds back into the next iteration. After max iterations, the best attempt is returned.

### Agent runtime (`agent/agent.ts`)

`runAgent()` is the shared agent loop used by Generator, Evaluator, and Modifier. It calls the LLM, executes any tool calls returned, feeds tool results back, and repeats until the agent emits a `TASK_COMPLETE` signal or hits `AGENT_MAX_ITERATIONS`. The task-complete signal contains `SUMMARIZATION` (JSON describing tool invocations) and `TASK_COMPLETE` (plain-text summary).

### LLM provider (`providers/`)

`createProvider()` returns an `OpenAIProvider` (OpenAI-compatible API, currently pointed at Alibaba DashScope). Config lives in `config/env.ts` — Zod validates all env vars at startup. The `@/*` path alias maps to the project root (see `tsconfig.json` paths).

### Tools (`tools/`)

Each agent role has its own tool registry mapping tool names to Zod-schema-validated implementations:
- **Generator**: `createFileWithDirectories` (writes files, creates parent dirs), `readFile` (reads files / lists directories)
- **Evaluator**: `readFile` only (verifies generator claims by inspecting actual files)
- **Modifier**: `readFile`, `createFileWithDirectories` (reads existing plan, writes modified plan)

Tool schemas live in `schemas/tools/`. `tools/tools.ts` handles generic tool execution and Zod-to-JSON-Schema conversion for the LLM.

### Input preprocessing (`utils/get_params.ts`)

`dataPreprocess()` finds files in `input_raw/` by name, processes Excel files via `parseExcelSchemaToFile()` (extracts sheet/column schemas using the `xlsx` library), and wraps plain-text files (`.md`, `.txt`, `.csv`, etc.) in JSON envelopes `{ type: "document", fileName, format, content }`. Results are written to `output_schemas/`. When called without `targetFiles`, it processes all supported files.

### Output format contract

The Generator emits two fenced blocks when done:
- ```` ```SUMMARIZATION ```` — raw JSON objects (one per tool call) describing what was created
- ```` ```TASK_COMPLETE ```` — brief plain-text summary

The Evaluator emits a `TASK_COMPLETE` block containing `## Overall Score` with a number and `Pass`/`Fail` keyword. `extractOverallScore()` regex-parses this to drive the loop.

The Planner emits `<PLAN_DOCUMENT>` with `<FILENAME>` and `<MARKDOWN>` child tags. `plannerParseResponse()` extracts these; `writePlanFile()` sanitizes the filename and writes to disk.

### Skills directory (`skills/`)

Each `skills/*.md` file is a system-prompt fragment loaded at runtime by the prompt builders in `prompts/`. The skill files define agent behavior, output formats, and evaluation rubrics. They are the primary mechanism for adjusting agent behavior — code changes are rarely needed for behavioral tweaks.
