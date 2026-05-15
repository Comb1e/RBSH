---
name: coding
description: >
  Use this skill whenever the user asks to write, generate, fix, refactor, or review code — in any language or framework. Triggers include: "write a function", "implement X", "fix this bug", "refactor", "add tests", "make this more robust", "write a script", "build a module", "help me code X", or any task where the primary deliverable is working source code. Also triggers for architecture design, code review, adding error handling, improving reliability, or writing test interfaces. This skill prioritizes robustness (defensive programming, comprehensive error handling, graceful degradation) above all else, and always preserves or adds testability hooks. Use it even if the user only pastes a code snippet and asks a quick question — the robustness-first mindset should always apply.
---

# Coding Skill

Produce code that is correct, robust, and testable. When in doubt, favor explicitness and defensiveness over cleverness or brevity.

---

## Core Priorities (in order)

1. **Robustness** — code must handle failure gracefully. See [Robustness Patterns](#robustness-patterns).
2. **Testability** — preserve and surface testing interfaces. See [Testing Interfaces](#testing-interfaces).
3. **Correctness** — the happy path must work exactly as specified.
4. **Clarity** — readable, well-named, lightly commented where non-obvious.
5. **Performance** — only after the above are satisfied.

---

## Workflow

### 1. Understand Before Writing

Before producing any code:

- Identify the language, runtime, and key constraints from context.
- Clarify ambiguity if the spec is genuinely underspecified (one question max).
- Note what can fail: I/O, network, user input, third-party APIs, concurrency, resource limits.

### 2. Plan the Structure

For non-trivial tasks, briefly outline:

- Module/function boundaries
- What errors each boundary must handle
- What testing hooks to expose

For simple tasks (single utility function, quick fix), skip the outline and code directly.

### 3. Write Robust, Testable Code

Apply the patterns below. Always produce complete, runnable code — no placeholders like `# TODO: implement this`.

### 4. Present and Explain

After the code:

- State what error conditions are handled and how.
- Point out the test interface (how to invoke tests, what test utilities are exported).
- Note any intentional tradeoffs or known limitations.

---

## Robustness Patterns

### Input Validation

Validate all inputs at system boundaries (function entry points, API handlers, file parsers). Reject early with clear error messages rather than letting invalid data propagate.

```python
# Good: validate early, fail loudly
def process_items(items: list[str]) -> list[str]:
    if not isinstance(items, list):
        raise TypeError(f"Expected list, got {type(items).__name__}")
    if not items:
        raise ValueError("items must not be empty")
    ...
```

### Error Handling

- Catch specific exceptions, not bare `except` / `catch (e)`.
- Attach context to errors (what operation failed, with what input).
- Return structured errors (Result/Either types, error objects) for recoverable failures; raise/throw for programming errors.
- Never silently swallow exceptions unless the suppression is intentional and documented.

```typescript
// Good: specific catch, context attached
async function fetchUser(id: string): Promise<Result<User, AppError>> {
  try {
    const res = await api.get(`/users/${id}`);
    return { ok: true, value: res.data };
  } catch (err) {
    if (err instanceof NetworkError) {
      return {
        ok: false,
        error: { code: "NETWORK_FAILURE", cause: err, userId: id },
      };
    }
    throw err; // unexpected — rethrow
  }
}
```

### Graceful Degradation

Where total failure is worse than partial results, design fallback paths:

- Timeouts with sensible defaults
- Retry with backoff for transient failures
- Partial results with a warnings array rather than an all-or-nothing throw
- Feature flags or capability checks before using optional dependencies

### Resource Management

- Always close/release resources (files, connections, locks) in `finally` blocks or with context managers / `using` / RAII.
- Enforce upper bounds on loops, retries, queue depths.
- Guard against unbounded memory growth (streaming large files, paginating APIs).

### Defensive Defaults

- Prefer immutability; avoid mutating inputs.
- Default to the safe option when a parameter is omitted.
- Assert invariants in critical sections (can be removed in production builds).

---

## Testing Interfaces

Testability is a first-class concern. Preserve or add the following:

### Pure Functions and Dependency Injection

Extract logic into pure functions wherever possible. Pass dependencies (clocks, loggers, HTTP clients, DB connections) as parameters rather than importing globals. This allows tests to substitute fakes without monkeypatching.

```python
# Testable: clock is injected
def is_expired(token: Token, *, now=None) -> bool:
    if now is None:
        now = datetime.utcnow()
    return token.expires_at < now
```

### Exported Test Utilities

For modules with complex internals, export helpers that let tests reach inside:

- Factory functions for test fixtures (`make_user(role="admin")`)
- Reset/seed functions for stateful modules
- Internal state accessors (behind a `__test__` or `_testing` namespace if appropriate)

### Seams for Mocking

Identify and expose seams — places where tests can substitute behavior:

- Configurable transport/adapter layer
- Injectable random number generator or UUID generator
- Event emitters that tests can listen to

### Inline Self-Test Block (Required)

Every Python module except the entry point (`main.py`) MUST include a runnable
`if __name__ == "__main__":` block with real test assertions — not stub function
calls, not `# TODO`, not a comment. The block must execute actual assertions
against the module's own functions using real data from `./input_data/`.

```python
# Good — real assertions that execute:
if __name__ == "__main__":
    loader = DataLoader("./input_data/report.xlsx")
    df = loader.load()
    assert len(df) > 0, "Expected non-empty dataframe"
    assert "product_id" in df.columns, "Missing product_id column"
    print("Tests passed.")
```

```python
# Bad — stub calls to undefined functions (FORBIDDEN):
if __name__ == "__main__":
    _test_happy_path()       # undefined!
    _test_empty_input()      # undefined!
    print("All smoke tests passed.")  # liar output
```

```python
# Bad — comment-only (FORBIDDEN):
if __name__ == "__main__":
    # TODO: add tests
    pass
```

The block must:
- Call the module's own functions with real arguments
- Use `assert` statements with descriptive messages
- Load test data from `./input_data/` when applicable
- Print a success message only after assertions pass

For library code without an entry point, the `if __name__` block is still required —
it serves as both test and usage example. A comment about testing is a placeholder.
Placeholders are forbidden.

### Test-Friendly Interfaces

- Functions should return values rather than printing/logging results so tests can assert on return values.
- Avoid `sys.exit()` / `process.exit()` inside library functions; raise exceptions instead so tests can catch them.
- Prefer deterministic outputs — if randomness is required, accept a seed parameter.

---

## Language-Specific Notes

For patterns specific to a language or framework, see `references/`:

- `references/python.md` — Python idioms, typing, async, packaging
- `references/typescript.md` — TypeScript patterns, Result types, Node vs browser
- `references/shell.md` — Bash robustness (`set -euo pipefail`, traps, quoting)
- `references/sql.md` — Safe queries, migrations, transaction patterns

Read the relevant file when producing substantial code in that language. For other languages, apply the general principles above and adapt idiomatically.

---

## Output Format

Present code in fenced code blocks with the language tag. For multi-file outputs, show each file with its path as a comment at the top:

```python
# src/auth/token.py
...
```

After the code, include a short **Notes** section:

- Error conditions handled
- How to run the tests
- Any known limitations or follow-up work

---

## Quick Reference: Robustness Checklist

Before finalising any non-trivial piece of code, verify:

- [ ] All inputs validated at entry points
- [ ] Specific exceptions caught with context attached
- [ ] Resources closed in finally / context manager / RAII
- [ ] No silent swallowing of exceptions
- [ ] Fallback or timeout for external calls
- [ ] Upper bounds on loops, retries, allocations
- [ ] Dependencies injectable (not hard-imported globals)
- [ ] Return values (not side effects) for core logic
- [ ] Every module (except main entry point) has an `if __name__` block with real assertions — no stub calls, no comments
