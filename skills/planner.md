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

### Filename rule (strict)

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

### First-generation rule

When code for a file is being **generated for the first time**, the entire
file is **one step**. Never split initial file generation across multiple
steps. Example:

```
// CORRECT
"Generate #pipeline/executor.go# with the Executor struct, Run method, and error-handling logic"

// WRONG
"Define the Executor struct in #executor.go#"
"Implement Run() in #executor.go#"
"Add error wrapping in #executor.go#"
```

Splitting is allowed in **later steps** once the file exists and the agent is
making targeted adjustments based on observed output.

### Adjustment steps

After generation or execution, the agent may add follow-up steps such as:

- "Fix compile errors in #executor.go# identified after first run"
- "Adjust Run() in #executor.go# to handle the nil-pipeline edge case found during testing"

These are fine and expected. The initial plan should not pre-empt them by
over-specifying; let the agent react to reality.

### Step count guidance

| Task scope                                 | Typical step count |
| ------------------------------------------ | ------------------ |
| Single-concern, single-file                | 1–2                |
| Feature touching 2–3 files                 | 2–4                |
| End-to-end feature (API + service + tests) | 3–6                |
| Large refactor or migration                | 4–8                |

If you're writing more than 8 steps, pause and ask: can some of these be
merged into a coarser step?

---

## Output Format

Always return a `string[]`. Each element is a plain-language string.
No sub-bullets. No markdown inside the strings. No numbering inside the
strings (the caller renders order). **Every step must name a file it writes
or modifies using the `#filename#` marker** (see Filename rule above).
Steps that only read, explore, or understand are not allowed.

**No plan needed** — single-element array with the raw task:

```json
["Add a null-check for the config pointer in #config/loader.go#"]
```

**Plan needed** — multi-element array of coarse steps, each with a #filename#:

```json
[
  "Implement RedisBackedPipelineStore in #storage/redis_pipeline_store.go#",
  "Wire the new store into the DI container in #app/wire.go#",
  "Add unit tests for RedisBackedPipelineStore in #storage/redis_pipeline_store_test.go#"
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
    YES ──► return [rawTask] ──► execute directly
     │
    NO
     │
     ▼
Draft coarse steps (1 step = 1 unit of work)
Each step must write/modify a file → mark it #filename#
First-gen file? ──► whole file = 1 step
     │
Return string[] of steps
```
