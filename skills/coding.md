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

## Writing New Code Using Existing Code

When the user provides existing files as context and asks for new functionality,
do not write from scratch. Treat the existing code as the source of truth for
conventions, interfaces, and patterns — the new code must fit in, not stand apart.

### Step 1: Read Before Writing

Before producing any new code, read every provided file and extract:

| What to extract        | Why it matters                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Naming conventions** | snake_case vs camelCase, prefixes, abbreviations in use                              |
| **Module structure**   | Where classes, functions, and constants live; how files import each other            |
| **Patterns in use**    | How errors are handled, how dependencies are injected, what return shapes look like  |
| **Existing utilities** | Helper functions, base classes, shared constants that the new code should reuse      |
| **Type signatures**    | Argument types, return types, and any data models (dataclasses, Pydantic, TypedDict) |

Do not infer these from general knowledge — read what is actually there.

### Step 2: Identify Reuse Points

Before writing any new logic, explicitly identify:

- **Functions/methods to call directly** — existing logic that already does what is needed; do not reimplement it.
- **Base classes or mixins to extend** — if the codebase uses inheritance patterns, follow them.
- **Shared error types to raise** — if the codebase defines custom exceptions, raise those, not generic ones.
- **Existing data models to accept or return** — if a `User` dataclass already exists, do not define a new one.

State these reuse points in a short comment at the top of the new code:

```python
# Reuses: DataLoader.load() from src/data_loader.py
#         ValidationError from src/errors.py
#         User model from src/models.py
```

### Step 3: Match Existing Conventions Exactly

New code must be indistinguishable in style from the existing code:

- **Same error handling style** — if existing code does `return None` on failure, don't raise; if it raises, don't return `None`.
- **Same logging calls** — use the same logger name and log-level conventions already present.
- **Same docstring format** — match Google-style, NumPy-style, or no docstrings, whichever is already used.
- **Same import order and grouping** — stdlib, then third-party, then local; match exactly.
- **Same type annotation style** — if the codebase uses `Optional[X]`, don't introduce `X | None` (or vice versa).

### Step 4: Do Not Duplicate Existing Logic

If the new feature needs something that existing code already does, call that
code — do not rewrite it:

```python
# Bad — duplicates parsing logic that already exists in src/parser.py
def new_feature(raw: str) -> dict:
    lines = raw.strip().split("\n")
    return {k: v for k, v in (line.split("=") for line in lines)}

# Good — calls the existing parser
from src.parser import parse_config

def new_feature(raw: str) -> dict:
    return parse_config(raw)
```

If existing logic is almost right but needs a small extension, extend or
parameterise it rather than copying and modifying:

```python
# Bad — copy-paste of load() with one line changed
def load_with_filter(path, key):
    ...  # 20 lines copied from DataLoader.load()

# Good — add an optional parameter to the existing method
class DataLoader:
    def load(self, filter_key: str | None = None) -> pd.DataFrame:
        df = self._read()
        if filter_key:
            df = df[df["key"] == filter_key]
        return df
```

### Step 5: Confirm Integration in the Test Block

The `if __name__ == "__main__":` block for any new submodule must import and
exercise the existing code it depends on, proving that the integration works
end-to-end — not just that the new function runs in isolation:

```python
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent.parent))

    # Integration: exercise new code through its dependency on existing modules
    from src.data_loader import DataLoader   # existing
    from src.new_feature import process      # new

    loader = DataLoader()
    data = loader.load()
    result = process(data)                   # new code consuming existing output
    assert result is not None, "process() returned None"
    print("Integration test passed.")
```

### Reuse Checklist

Before submitting new code written against an existing codebase:

- [ ] All provided files read; naming, structure, and patterns extracted
- [ ] Existing utilities, base classes, and models identified and reused — nothing reimplemented that already exists
- [ ] Custom exception types from the codebase used (not generic `Exception`)
- [ ] Style matches exactly: error handling, logging, docstrings, imports, type annotations
- [ ] New logic integrated and tested against existing code in the `if __name__` block, not just in isolation

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

### Running Submodules Directly — Sibling Import Fix (Required)

Consider this layout:

```
project/
├── main.py
└── src/
    ├── A.py        ← imports from B
    └── B.py
```

`A.py` imports its sibling with:

```python
from src.B import some_func   # works when main.py runs it; breaks when A.py runs directly
```

`python main.py` works because Python adds the project root to `sys.path`, so
`src` is a resolvable package. `python src/A.py` breaks because Python adds
`src/` to `sys.path` instead — there is no `src` package visible from inside
itself, so `from src.B import ...` raises `ModuleNotFoundError: No module named 'src'`.

**Fix: insert the project root inside the `if __name__` guard**

```python
# src/A.py
import sys
from pathlib import Path

from src.B import some_func   # normal module-level import — works when imported by main.py

def run():
    return some_func()

if __name__ == "__main__":
    # Add the project root to sys.path so 'src' is resolvable as a package.
    # Must be inside this guard — never at module level — so it doesn't
    # pollute sys.path when main.py imports this module normally.
    sys.path.insert(0, str(Path(__file__).parent.parent))

    # Re-import after path fix (the module-level import above ran before the fix)
    from src.B import some_func

    result = run()
    assert result is not None, "Expected a result from run()"
    print("Tests passed.")
```

Why the re-import is needed: the module-level `from src.B import some_func`
executes before the `if __name__` block runs, so it already failed. Repeating
the import inside the block — after the `sys.path` fix — loads it successfully.

**Alternative: run as a module instead of a file**

```bash
# From the project root — no sys.path fix needed, Python resolves src as a package
python -m src.A
```

This is cleaner when running manually, but requires the `if __name__` test block
to still be present. The `sys.path` fix is still needed if the file might be
executed directly (e.g. by a script runner, CI step, or another developer).

**Depth formula**

The number of `.parent` calls to reach the project root:

| File location       | `sys.path.insert` argument                          |
| ------------------- | --------------------------------------------------- |
| `src/A.py`          | `Path(__file__).parent.parent` (2 levels up)        |
| `src/pipeline/A.py` | `Path(__file__).parent.parent.parent` (3 levels up) |

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
- [ ] Submodules with sibling imports (`from src.B import ...`) insert the project root onto `sys.path` inside the `if __name__` guard, then re-import after the fix

## Quick Reference: Error-Fixing Checklist

When fixing code from an error report:

- [ ] Error type, message, location, and proximate cause all identified
- [ ] Root cause category classified (null data / type mismatch / missing dep / IO / logic / concurrency / config)
- [ ] True origin traced (not just the symptom site patched)
- [ ] Fix is minimal and targeted — no unrelated refactoring mixed in
- [ ] Guard added at callsite if origin is external/uncontrollable, with comment explaining why
- [ ] Regression test added to `if __name__` block covering the previously failing case
- [ ] Fix Notes section written: root cause, fix applied, regression test, scope of change
