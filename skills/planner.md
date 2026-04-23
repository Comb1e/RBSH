---
name: harness-planner
description: >
  Planning skill for the Harness engineering agent. Use this skill whenever
  the agent needs to decide whether a task requires a plan and, if so, how to
  structure one. Triggers on any agentic coding or engineering task in a
  Harness context: feature implementation, bug fixes, refactors, file
  generation, test writing, config changes, and multi-step workflows. Also
  triggers when the agent is uncertain whether to plan or just act. Do NOT
  skip this skill for tasks that touch more than one file or concept — even if
  they feel small, consult the decision rules below before proceeding.
---

# Harness Planner

A lightweight planning layer for the Harness engineering agent. Its job is to
decide **whether** a plan is needed and, when one is, to produce a
**coarse-grained** plan — not a step-by-step script.

The output of this skill is always a `string[]`:

- **No plan needed** → return `[rawTask]` — a single-element array containing
  the original task string verbatim. The caller executes it directly.
- **Plan needed** → return a multi-element array where each string is one
  coarse step.

---

## Decision Rule: Does This Task Need a Plan?

### No plan needed → return `[rawTask]`

Skip planning entirely when the task is **self-contained and unambiguous**.
Return a single-element array containing the original task string verbatim.

Common examples:

- **Single-file edits with clear instructions** — "Fix the typo in
  #auth.service.ts# line 42", "Add a missing null-check in #parser.go#"
- **Lookup / read-only tasks** — "Show me the current retry config",
  "List all files that import #pipeline.core#"
- **Simple one-liner commands** — running a formatter, a linter, a single
  grep, or a git status
- **Reproducing a clearly-described bug with a unit test** (single file, clear
  expected behaviour)
- **Generating boilerplate from a template** where the template already
  specifies all the content
- **Trivial generation** — "Create an empty #utils_test.go# file",
  "Add a TODO comment to #main.go#"
- **Knowledge / identity questions** — "Who are you?", "Do you know about X?",
  "What is Y?" — see dedicated section below

If the task matches any of the above, return `[rawTask]` and proceed to
execution.

---

### Plan needed → return a `string[]` of coarse steps

Plan when the task is **multi-concern**, **cross-file**, **ambiguous in
sequencing**, or **risky enough that mistakes are hard to reverse**.

Typical triggers:

- Touches **two or more files** with interdependent changes
- Requires **understanding existing code** before writing new code (e.g.,
  tracing a data flow, reading an interface, checking how a service is wired)
- Involves **a new feature end-to-end** (API → service → storage → test)
- Involves **a non-trivial refactor** that changes public interfaces or module
  boundaries
- Requires **sequential decisions** where step N depends on the outcome of
  step N-1
- Has **meaningful rollback risk** (database migrations, config flag changes,
  dependency upgrades)

---

## Handling Knowledge and Identity Questions

When the user asks "Who are you?", "Do you know about X?", "Can you do Y?",
or "What is Z?" — treat this as a no-plan task and return `[rawTask]`.
When executing, apply both rules below simultaneously in a single response.

### Rule 1 — Be honest about your knowledge boundary

State clearly and upfront whether you know the topic or not. Don't guess,
don't over-hedge. Examples:

- "I know about X." / "I'm not familiar with X."
- "I'm the Harness engineering agent, built to help with [scope]."

### Rule 2 — Provide the relevant information directly in the same response

Don't stop at the yes/no. Immediately follow with the substance:

- If you **know** the topic → give the relevant information right away.
- If you **don't know** → say so, then offer the closest related information
  you do have, or tell the user where they can find it.

**Good** (honest + immediately useful):

> "Yes, I know about Harness pipelines. A pipeline is a sequence of stages
> that define your CI/CD workflow. Each stage runs independently and can
> depend on outputs of earlier stages. To add a new stage you…"

**Bad** (honest but not useful):

> "Yes, I know about Harness pipelines. Would you like me to explain them?"

This rule applies to identity questions too — don't just say what you are,
explain what you can do and provide a concrete example if helpful.

---

## How to Write the Plan

### Coarseness rule (most important)

**One step = one coherent unit of work**, not one line of code.

Good step granularity:

- "Implement the FlagEvaluator service in #flag/evaluator.go#"
- "Add the HTTP handler and route registration in #api/flags.go#"
- "Write integration tests covering the happy path and the flag-disabled path in #flag/evaluator_test.go#"

Bad step granularity (too fine):

- "Open #flag/evaluator.go#"
- "Define the struct fields"
- "Write the Evaluate method signature"
- "Fill in the method body"
- "Add the return statement"

The bad examples above are all part of _one_ coarse step: writing the
evaluator file. Don't split them.

### Step ordering rule (critical)

**The order of steps is not arbitrary — it is the execution contract.** The
generator agent writes files in the exact order they appear in the plan. A
file written early can be imported and depended on by files written later. A
file written late cannot be referenced by files written earlier. Getting the
order wrong means the agent generates code that imports things that do not
exist yet, producing broken, unrunnable output.

**The golden rule: data in, processing, data out, wiring.**
Always build the pipeline from the inside out — start at the raw data source
and work outward toward the entry point that runs everything.

#### Canonical layer order

Follow this sequence strictly. Each layer depends only on layers above it:

1. **Data loading** _(always first)_ — files that read, fetch, or parse raw
   input: file readers, Excel/CSV parsers, database queries, API clients.
   These are the foundation everything else builds on. A solver cannot exist
   without something to feed it; a data loader can exist independently of
   everything. **Data loading is always the first substantive step.**

2. **Data modelling / schema** — data classes, structs, types, or schemas
   that represent the loaded data in a structured form. Defined immediately
   after loading so downstream layers have a stable contract to program
   against.

3. **Core logic / algorithms** _(solvers, engines, calculators)_ — the
   business-critical computation. This layer consumes structured data from
   layer 1–2 and produces results. It knows nothing about where data came
   from or where results go. **Solvers and algorithm files always come after
   the data layer**, never before.

4. **Support / utilities** — helpers, config loaders, shared constants,
   logging, validators. These are standalone and may be inserted wherever
   the first file that needs them appears.

5. **Output / export layer** — files that format, serialise, or write
   results: CSV exporters, report generators, API response formatters.
   These depend on core logic output and go after it.

6. **Tests** — test files follow the file they cover, in the same layer order.

7. **Entry point / orchestration** _(always last substantive step)_ — the
   main runner, CLI, or top-level script that imports and wires all other
   modules, then executes the full pipeline end to end. **This is always the
   last file the agent writes**, because it depends on everything else.

8. **README** — #README.md# is second to last (see closing steps rule).

9. **Completion summary** — always last (see closing steps rule).

#### Examples

**Bad** — solver created before the data loader it depends on:

```
1. "Create #solver.py# to compute the optimal dispatch using LP"
2. "Create #data_loader.py# to parse input from P6.xls"
3. "Create #main.py# to run the pipeline"
```

**Bad** — entry point created before the modules it orchestrates:

```
1. "Create #main.py# to run the full pipeline"
2. "Create #data_loader.py# to parse input files"
3. "Create #solver.py# to compute the result"
```

**Good** — data first, solver after, entry point last:

```
1. "Create #data_loader.py# to read and parse all sheets from P6.xls"
2. "Create #solver.py# to compute the optimal dispatch using the parsed data"
3. "Create #exporter.py# to write the schedule output to dispatch_result.csv"
4. "Create #main.py# to orchestrate loading, solving, and exporting"
5. "Write a summary of all changes made in this task to #README.md#"
6. "Report to the user whether the task completed successfully and what was done in one or two sentences"
```

If two files within the same layer have no dependency on each other, order
them by domain proximity (group related modules together).

**A step only exists if it writes or modifies a file.** If a step does not
produce a file change, it must not appear in the plan — not even as a
"read", "understand", "explore", or "investigate" step.

This is a hard filter, not a formatting requirement:

- **No read-only steps.** "Read #storage/pipeline_store.go# to understand the
  interface" is not a valid step. Understanding happens silently during the
  write step that follows.
- **No investigation steps.** "Check how the DI container is wired" is not a
  valid step. If this knowledge is needed, it is consumed inside the step that
  actually writes the affected file.
- **No planning steps.** "Decide the schema for the new table" is not a valid
  step. Decisions are made implicitly before writing the migration file.
- **Every step must name the file it creates or modifies** using the `#filename#`
  marker and the full relative path from the repo root: #storage/redis_pipeline_store.go#,
  not just the bare name or a prose description.
- If a step modifies multiple files, mark all of them: "Update the interface
  in #storage/pipeline_store.go# and the mock in #storage/mock_pipeline_store.go#"
- If the file does not exist yet, use the intended path: "Create
  #api/flags/handler.go# with the HTTP handler and route registration"

**`#filename#` scope — generator-written files only:**
`#filename#` must be used **exclusively** for files that the generator agent
itself will create or modify. It must **not** be applied to:

- Files that the written code produces at runtime (e.g., a CSV export, a log
  file, a generated report)
- Files that are merely mentioned, referenced, or described as outputs of the
  program's behaviour

The distinction is: _does the agent's code-writing action touch this file?_
If yes → `#filename#`. If the file is produced later when the code runs →
plain text, no markers.

**Bad** (runtime output file incorrectly marked):

```
"Write result export logic in #economic_dispatch_solver.py# to output the
optimal generation schedule to a CSV file #dispatch_result_hour12.csv#"
```

**Good** (only the source file the agent writes is marked):

```
"Write result export logic in #economic_dispatch_solver.py# to output the
optimal generation schedule to a CSV file dispatch_result_hour12.csv"
```

**Implication for prerequisite understanding:** If implementing a file
requires reading another file first (e.g., reading an interface before
implementing it), that reading is not a separate step. The agent does it
autonomously before writing. Only the write step is planned.

**Bad** (read-only step — not allowed):

```
"Read storage/pipeline_store.go to understand the PipelineStore contract"
```

**Good** (write step that implicitly requires that understanding):

```
"Implement RedisBackedPipelineStore in #storage/redis_pipeline_store.go#"
```

### One file, one step (strict)

**Each file may appear in at most one step of the initial plan.** Once a
filename is used in a step, it must not appear in any other step — all logic
for that file belongs inside the single step that owns it.

This is an extension of the coarseness rule. A file is the atomic unit of
work. If a task requires multiple things to happen inside one file (parsing,
optimisation, output formatting, etc.), those things are **not** separate
steps — they are all described within the single step for that file.

**Bad** (same file split across four steps — not allowed):

```
1. "Create #economic_dispatch_solver.py# to implement the solver that reads P6.xls and computes the optimal schedule for hour 12"
2. "Implement Excel parsing logic in #economic_dispatch_solver.py# to load data from all sheets"
3. "Add optimisation logic in #economic_dispatch_solver.py# using scipy.optimize.linprog"
4. "Write result export logic in #economic_dispatch_solver.py# to save the schedule to dispatch_result_hour12.csv"
```

**Good** (all logic for the file combined into one step):

```
1. "Create #economic_dispatch_solver.py# to read P6.xls, parse all required sheets, solve the economic dispatch for hour 12 using linear programming, and export the result to dispatch_result_hour12.csv"
```

**Alternative good** (if the work genuinely spans distinct files):

```
1. "Create #economic_dispatch_solver.py# with the optimisation core: load data from P6.xls, apply LP constraints, and return the schedule"
2. "Create #dispatch_exporter.py# to format and save the solver output to dispatch_result_hour12.csv"
```

**One exception — adjustment steps:** after a file has been generated and
the agent has observed a runtime error or test failure, a follow-up step may
target the same file to fix the specific issue found. These reactive steps are
not planned upfront; they are added dynamically based on observed output.

### Adjustment steps

After generation or execution, the agent may add follow-up steps such as:

- "Fix compile errors in #executor.go# identified after first run"
- "Adjust Run() in #executor.go# to handle the nil-pipeline edge case found during testing"

These are fine and expected. The initial plan should not pre-empt them by
over-specifying; let the agent react to reality.

### README step and completion summary (required, always last two)

Every plan must end with exactly these two steps in this order:

**Second-to-last — README step:**
Write the #README.md# file documenting what was done: files created or
modified, what the feature or fix achieves, and key decisions made. Phrased as:

```
"Write a summary of all changes made in this task to #README.md#"
```

**Last — completion summary step:**
A condensed plain-text message to the user confirming whether the task
completed and briefly how. This step does **not** write a file — it is the
only exception to the filename rule. It must be short (one or two sentences
maximum). Phrased as:

```
"Report to the user whether the task completed successfully and what was done in one or two sentences"
```

Neither step may be reordered, skipped, or merged into each other.

### Step count guidance

| Task scope                                 | Typical step count (excl. last two) |
| ------------------------------------------ | ----------------------------------- |
| Single-concern, single-file                | 1–2                                 |
| Feature touching 2–3 files                 | 2–4                                 |
| End-to-end feature (API + service + tests) | 3–6                                 |
| Large refactor or migration                | 4–8                                 |

The README and completion summary steps are always appended after these, so
the total array length is always N+2.

If you're writing more than 8 non-closing steps, pause and ask: can some be
merged into a coarser step?

---

## Output Format

Always return a `string[]`. Each element is a plain-language string.
No sub-bullets. No markdown inside the strings. No numbering inside the
strings (the caller renders order). **Every step except the final completion
summary must name a file it writes or modifies using the `#filename#`
marker** (see Filename rule above). Steps that only read, explore, or
understand are not allowed. **The second-to-last element must always be the
README step; the last element must always be the completion summary.**

**No plan needed** — single-element array with the raw task (no closing steps):

```json
["Add a null-check for the config pointer in #config/loader.go#"]
```

**Plan needed** — multi-element array ending with README then completion summary:

```json
[
  "Implement RedisBackedPipelineStore in #storage/redis_pipeline_store.go#",
  "Wire the new store into the DI container in #app/wire.go#",
  "Add unit tests for RedisBackedPipelineStore in #storage/redis_pipeline_store_test.go#",
  "Write a summary of all changes made in this task to #README.md#",
  "Report to the user whether the task completed successfully and what was done in one or two sentences"
]
```

---

## Quick Reference

```
Task received
     │
     ▼
Knowledge / identity question?
     │
    YES ──► return [rawTask] ──► answer honestly + give info directly
     │
    NO
     │
     ▼
Self-contained & unambiguous?
     │
    YES ──► return [rawTask] ──► execute directly (no closing steps)
     │
    NO
     │
     ▼
Draft coarse steps (1 step = 1 unit of work)
Each step must write/modify a file → mark it #filename#
One file per step, ordered by dependency (data layer → core → entry point)
     │
Append README step → "Write a summary of all changes made in this task to #README.md#"
Append completion summary → "Report to the user whether the task completed successfully and what was done in one or two sentences"
     │
Return string[] of steps
```
