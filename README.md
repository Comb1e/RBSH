# RBSH — Reinforcement-Based Software Harness

A GAN-inspired **harness engineering pipeline**: a Generator produces output while an adversarial Evaluator scores it, looping until the output passes a quality threshold.

## Overview

RBSH automates software project creation through a multi-phase pipeline:

1. **Explain** — analyzes input data (Excel, CSV, text, etc.) and produces a data dictionary (`schema.md`)
2. **Plan** — generates a structured development plan with module breakdowns and timelines
3. **Execute** — runs each module step through a Generator↔Evaluator adversarial loop, with auto-verification (type-check + execution)

The Generator writes code; the Evaluator scores it. If the score is too low, evaluation critique feeds back into the next iteration. This repeats until the output passes or the maximum iterations are reached.

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — set your LLM provider API key and endpoint

# Full pipeline: explain data → plan → execute
npx tsx main.ts explain my-project --add data.xlsx
```

## Commands

```bash
npx tsx main.ts explain <name>              # Full pipeline (explain → plan → execute)
npx tsx main.ts explain <name> --add file.xlsx  # Preprocess input files first
npx tsx main.ts plan <name>                 # Skip explain, go to plan (reads schema.md if present)
npx tsx main.ts execute <name>              # Run harness on an existing plan
npx tsc --noEmit                            # Type-check only
```

## Pipeline Phases

### Explain
Reads input files from `input_raw/`, extracts schemas (sheet/column analysis for Excel, content wrapping for plain text), and writes a `schema.md` data dictionary. After writing, enters modification mode for refinement.

### Plan
Generates `<PLAN_DOCUMENT>` with four required sections:
- **Project Overview**
- **Technical Stack**
- **Module Division** — each H3 heading becomes a Generator↔Evaluator step
- **Development Timeline**

The planner receives the explainer's `schema.md` as context.

### Execute
Reads the plan, extracts module steps from `## 3. Module Division`, and runs each through the Generator↔Evaluator loop. Output lands in `output/<project-name>/`.

### Interactive Interrupt
Press **Esc** during any agent execution to pause and provide feedback. Type `q` + Enter to abort.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `LLM_API_KEY` | API key for the LLM provider |
| `LLM_BASE_URL` | Base URL for the OpenAI-compatible API |
| `LLM_MODEL` | Model name to use |
| `AGENT_MAX_ITERATIONS` | Max iterations per agent loop (default: 15) |
| `PASSING_THRESHOLD` | Score threshold for Generator↔Evaluator acceptance (default: 80) |

## Project Structure

```
├── agent/          # Agent runtimes: Generator, Evaluator, Modifier, Explainer, Planner, Harness
├── config/         # Environment config (Zod-validated)
├── input_raw/      # Place input files here for --add
├── output/         # Generated projects and plans
├── output_schemas/ # Preprocessed schema files
├── prompts/        # Per-role prompt builders
├── providers/      # LLM provider abstraction (OpenAI-compatible)
├── schemas/        # Zod schemas for tools and data
├── skills/         # System-prompt fragments defining agent behavior and evaluation rubrics
├── tools/          # Tool implementations (readFile, executeCommand, createFileWithDirectories)
├── types/          # TypeScript type definitions
├── utils/          # Input parsing, output extraction, file I/O
├── main.ts         # Entry point and REPL dispatch loop
└── taskTypes/      # Task type classification
```
