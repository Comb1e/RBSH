# RBSH - Agent Harness

Most coded by Claude.
A production-oriented agent sample built on the **OpenAI**, demonstrating core **harness engineering**
patterns from Anthropic's published research. Currently not support anthropic

---

## Configure

```powershell
cp .env.example .env
```

## Quick start

```bash
# Install dependencies
npm install

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run
npx tsx main.ts
```

---

## What is a harness?

A **framework** (LangChain, CrewAI, etc.) gives you building blocks.
A **harness** is the runtime infrastructure that governs _how_ an agent
executes: what context it receives, how failures are handled, when sessions
are reset, and what the evaluation loop looks like.

---

## Architecture — three-agent pipeline

```
User task
    │
    ▼
┌─────────────┐
│   Planner   │  Decomposes the task into 3-6 sequential steps (JSON output)
└──────┬──────┘
       │  steps[]
       ▼
  ┌────────────────────────────────────────┐
  │  for each step                         │
  │                                        │
  │  ┌─────────────┐    draft              │
  │  │  Generator  │──────────────────┐    │
  │  └─────────────┘                  │    │
  │        ▲                          ▼    │
  │        │ critique          ┌──────────┐│
  │        └───────────────────│ Evaluator││
  │                            └──────────┘│
  │                  score ≥ 7 → accept    │
  └────────────────────────────────────────┘
       │  final output
       ▼
  Structured HandoffArtifact → next step
```

---

## Harness engineering patterns implemented

| Pattern                           | Where                                  | Why                                                              |
| --------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| **Context resets**                | Each `query()` call is a fresh session | Prevents context anxiety and drift on long tasks                 |
| **Structured handoff artifacts**  | `HandoffArtifact` interface            | Carries state across resets without polluting context            |
| **Generator ↔ Evaluator loop**    | `generatorEvaluatorLoop()`             | Separating judge from generator eliminates self-praise bias      |
| **Explicit grading criteria**     | Evaluator prompt (4 × 2.5 pts)         | Turns subjective "is this good?" into gradable criteria          |
| **Tool allowlist**                | `tools: ["Read", "Bash"]`              | Fewer tools = fewer wrong choices (Vercel's paradox)             |
| **Pre/Post tool hooks**           | `hooks.PreToolUse / PostToolUse`       | Observability and guardrails without modifying agent logic       |
| **Token budget awareness**        | `taskBudget: 40_000`                   | Agent paces itself; avoids runaway sessions                      |
| **Retry with critique injection** | Iteration loop                         | Critique becomes next iteration's context → targeted improvement |

---

## Key files

```
main.ts       — Main harness orchestrator + all three agents
package.json   — Dependencies
README.md      — This file
```

---

## References

- [Harness design for long-running app development](https://www.anthropic.com/engineering/harness-design-long-running-apps) — Anthropic Engineering
- [Claude Agent SDK TypeScript reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
