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

## Error-Driven Code Fixing

When the user provides an error message, traceback, or runtime output alongside broken code, follow this structured diagnosis-before-fix workflow. Do not guess or jump to patching — read the signal the error provides.

### Step 1: Parse the Error Signal

Before touching any code, extract these four things from the error:

| Field               | What to look for                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Error type**      | The exception class or error code (e.g. `TypeError`, `ECONNREFUSED`, `segfault`, `KeyError`) |
| **Error message**   | The human-readable description (e.g. `'NoneType' object is not subscriptable`)               |
| **Location**        | File name, line number, function name from the traceback                                     |
| **Proximate cause** | The last frame in the stack — the exact line that threw                                      |

```
# Example: Python traceback
Traceback (most recent call last):
  File "pipeline.py", line 42, in run_pipeline   ← location
    result = process(data["records"])             ← proximate cause
KeyError: 'records'                               ← type + message
```

### Step 2: Classify the Root Cause

Map the error type to a root cause category. This determines the fix strategy:

| Category                        | Typical error types                                                                                                            | Fix strategy                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Missing / null data**         | `KeyError`, `IndexError`, `NullPointerException`, `AttributeError: NoneType`, `TypeError: cannot read properties of undefined` | Add guard clauses, default values, or early validation                 |
| **Type mismatch**               | `TypeError`, `ValueError`, `ClassCastException`, `cannot convert X to Y`                                                       | Coerce or validate at input boundary; narrow the type                  |
| **Missing dependency / import** | `ModuleNotFoundError`, `ImportError`, `Cannot find module`, `ClassNotFoundException`                                           | Install the package; check the import path; handle optional deps       |
| **Resource / IO failure**       | `FileNotFoundError`, `ENOENT`, `ConnectionError`, `TimeoutError`, `PermissionError`                                            | Add existence checks, retry logic, or fallback paths                   |
| **Logic / assertion error**     | `AssertionError`, `ZeroDivisionError`, `OverflowError`, unexpected wrong output                                                | Trace the data flow; fix the invariant that was assumed but violated   |
| **Concurrency / state**         | `race condition`, `deadlock`, `ConcurrentModificationException`                                                                | Introduce locks, queues, or immutable data; avoid shared mutable state |
| **Environment / config**        | `EnvironmentError`, missing env var, wrong path, version mismatch                                                              | Validate config at startup; document required env vars                 |

### Step 3: Trace to the True Origin

The proximate cause (where the error was thrown) is often not where the bug lives. Walk up the stack:

- If a function receives `None` but doesn't expect it, ask: _who called it with `None`?_
- If a key is missing from a dict, ask: _where was this dict created, and why doesn't it have that key?_
- If a type is wrong, ask: _where was this value last assigned, and what coercion was assumed?_

Fix at the true origin, not the symptom site — unless fixing at the origin is unsafe or out of scope, in which case add a **defensive guard at the callsite** and leave a comment explaining why.

```python
# Guard at callsite (origin is external/uncontrollable)
records = data.get("records")  # API may omit key on empty result
if records is None:
    logger.warning("No 'records' key in response; skipping processing")
    return []
result = process(records)
```

### Step 4: Apply a Targeted, Minimal Fix

- Change only what is necessary to address the root cause.
- Do not refactor unrelated code in the same pass — that obscures what actually fixed the error.
- If the fix requires a structural change (e.g., adding validation at a module boundary), make that change explicitly and explain it.

After the fix, add or update the relevant test in the `if __name__ == "__main__":` block to cover the previously failing case:

```python
# Add a regression test for the fixed case
if __name__ == "__main__":
    # Regression: data without 'records' key must not raise
    result = run_pipeline({"status": "empty"})
    assert result == [], f"Expected [], got {result}"
    print("Regression test passed.")
```

### Step 5: Explain the Fix

After presenting the corrected code, include a short **Fix Notes** section:

```
Fix Notes:
- Root cause: `data["records"]` raised KeyError when the upstream API returns
  {"status": "empty"} on no results — the key is conditionally absent.
- Fix: replaced dict subscript with `.get("records")` and added an early-return
  guard for the None case.
- Regression test added: run_pipeline({"status": "empty"}) now asserts [].
- No other logic changed.
```

### Common Error Patterns and Their Standard Fixes

#### `NoneType` / null-reference errors

```python
# Bad — assumes value is always present
user = get_user(user_id)
print(user.name)

# Good — guard before access
user = get_user(user_id)
if user is None:
    raise ValueError(f"User {user_id!r} not found")
print(user.name)
```

#### `KeyError` / missing dict key

```python
# Bad
lang = config["language"]

# Good — explicit fallback or early validation
lang = config.get("language", "en")          # if a default is acceptable
# OR
if "language" not in config:
    raise KeyError("config missing required key 'language'")
lang = config["language"]
```

#### `TypeError` — wrong type passed

```python
# Bad — silent wrong-type usage
def total(items):
    return sum(items)    # blows up if items is None or a string

# Good — validate at entry
def total(items: list[int | float]) -> float:
    if not isinstance(items, (list, tuple)):
        raise TypeError(f"Expected list or tuple, got {type(items).__name__}")
    return sum(items)
```

#### `ModuleNotFoundError` / `ImportError`

```python
# Pattern: optional dependency with helpful error
try:
    import pandas as pd
except ImportError as e:
    raise ImportError(
        "pandas is required for this module. Install it with: pip install pandas"
    ) from e
```

#### `FileNotFoundError` / `ENOENT`

```python
# Bad
with open(path) as f:
    data = f.read()

# Good — check existence, give clear context
from pathlib import Path
p = Path(path)
if not p.exists():
    raise FileNotFoundError(f"Input file not found: {p.resolve()}")
with p.open() as f:
    data = f.read()
```

#### Async / `Promise` rejection not handled (JavaScript/TypeScript)

```typescript
// Bad — unhandled rejection
fetchData().then((d) => process(d));

// Good — always handle the rejection path
fetchData()
  .then((d) => process(d))
  .catch((err) => {
    logger.error("fetchData failed", { cause: err });
    // re-throw or return fallback depending on context
    throw err;
  });
```

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

## Quick Reference: Error-Fixing Checklist

When fixing code from an error report:

- [ ] Error type, message, location, and proximate cause all identified
- [ ] Root cause category classified (null data / type mismatch / missing dep / IO / logic / concurrency / config)
- [ ] True origin traced (not just the symptom site patched)
- [ ] Fix is minimal and targeted — no unrelated refactoring mixed in
- [ ] Guard added at callsite if origin is external/uncontrollable, with comment explaining why
- [ ] Regression test added to `if __name__` block covering the previously failing case
- [ ] Fix Notes section written: root cause, fix applied, regression test, scope of change
