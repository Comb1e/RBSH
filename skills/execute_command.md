# executeCommand — Agent Usage Specification

## Overview

`executeCommand` spawns a child process and returns its output. It is the primary tool for running code, installing packages, reading files, and modifying the filesystem. All operations are sandboxed to the project directory; dangerous shell patterns are unconditionally blocked regardless of intent.

---

## Invocation Schema

```json
{
  "command": "<binary or script>",
  "args": ["<arg1>", "<arg2>"],
  "cwd": "/path/within/project",
  "shell": false,
  "env": { "KEY": "value" },
  "input": "optional stdin string",
  "timeout": 30000,
  "maxBuffer": 10485760
}
```

**Required**: `command`
**Optional**: all other fields
**Defaults**: `shell: false`, `timeout: 30 000 ms`, `maxBuffer: 10 MB`, `cwd: projectOutputDir ?? process.cwd()`

---

## Core Rules

### 1. Arguments always go in `args`

Never embed arguments in the `command` string. The tool spawns with `shell: false` by default, so shell parsing does not apply.

```jsonc
// CORRECT
{ "command": "python", "args": ["./src/main.py", "--verbose"] }

// WRONG — shell is false, the whole string becomes the binary name
{ "command": "python ./src/main.py --verbose" }
```

### 2. Set `cwd` for relative-path scripts

If a script resolves files relative to its own location, set `cwd` to that directory. Omitting `cwd` defaults to `projectOutputDir`, which may not match where the script expects to run.

```jsonc
{ "command": "node", "args": ["index.js"], "cwd": "./output/my-project" }
```

### 3. Never enable `shell: true` unless strictly required

Shell mode exposes the full shell pipeline to injection. Prefer passing arguments via `args`. If a pipeline is genuinely necessary (`command1 | command2`), enable `shell: true` and pass the full command as a single string — but treat this as an escalation requiring justification.

### 4. Do not call `shell: true` + dangerous patterns

The blocked-pattern scanner runs on the assembled command string regardless of shell mode. The following constructs are always rejected:

| Pattern                  | Reason                      |
| ------------------------ | --------------------------- |
| `rm -rf /` or `rm -rf ~` | Destructive filesystem wipe |
| `dd if=…`                | Raw disk operation          |
| `mkfs`                   | Filesystem creation         |
| `chmod 777 /`            | World-writable root         |
| `> /dev/sd*`             | Block device overwrite      |
| `: () { :; }; :`         | Fork bomb                   |
| `sudo rm`                | Privileged delete           |
| `> /etc/`                | Overwriting system config   |
| `curl … \| (ba)?sh`      | Remote code execution       |
| `wget -O - \|`           | Remote code execution       |

---

## Return Value

```ts
{
  success:     boolean,
  stdout?:     string,      // up to 1 000 chars on success, 3 000 on failure
  stderr?:     string,      // up to 500 chars on success, 3 000 on failure
  exitCode?:   number | null,
  duration?:   number,      // milliseconds
  diagnostics?: string[],   // matched error patterns even when exitCode === 0
  timedOut?:   boolean,
  error?:      string       // spawn failures or security rejections
}
```

`success` is `true` only when `exitCode === 0` **and** `timedOut === false`.

---

## Interpreting Results

### Check `success` first

```js
if (!result.success) {
  // exitCode, stderr, diagnostics are your debugging surface
}
```

### `diagnostics` fires even on exit 0

A process can print a Python traceback or a Node `TypeError` and still exit 0 if the error was caught internally. Always inspect `diagnostics` even after a successful run:

```js
if (result.diagnostics?.length) {
  // e.g. ["[Python runtime error] ValueError: list index out of range"]
}
```

Recognised error patterns include: Python tracebacks, `ModuleNotFoundError`, `TypeError`, `FileNotFoundError`; Node `ReferenceError`, `UnhandledPromiseRejection`, `Cannot find module`; shell signals `SIGSEGV`, `command not found`, `Permission denied`; R errors; and generic `panic` / `fatal:`.

### Sensitive values are redacted

Any token, password, API key, or secret appearing in stdout/stderr is replaced with `***REDACTED***` before the result is returned. Do not attempt to recover these values from output; pass them via `env` if they are needed at runtime.

### `timedOut: true` means partial output

When a soft-timeout fires (default 30 s), the process receives `SIGTERM`. Ten seconds later it is `SIGKILL`ed. The `stdout` and `stderr` fields contain whatever was buffered before the kill. Treat the output as potentially truncated.

---

## Timeout and Buffer Guidance

| Task type                          | Recommended timeout  |
| ---------------------------------- | -------------------- |
| File read / grep / sed             | Default (30 s)       |
| Test suite (unit)                  | 60 000 ms            |
| Full build or compile              | 120 000 – 300 000 ms |
| Dependency installation (npm, pip) | 120 000 ms           |
| Long-running data pipeline         | 600 000 ms           |

The `maxBuffer` default (10 MB) covers most outputs. If a script produces large CSV or log files, write them to disk and read them separately rather than relying on stdout capture.

---

## Common Patterns

### Run a script

```jsonc
{ "command": "python", "args": ["./src/analyse.py"], "cwd": "./output/project" }
```

### Type-check without emitting

```jsonc
{ "command": "npx", "args": ["tsc", "--noEmit"] }
```

### Install dependencies

```jsonc
{ "command": "npm", "args": ["install"], "cwd": "./output/project" }
```

### Read a file

```jsonc
{ "command": "cat", "args": ["./output/project/README.md"] }
```

### Find a string in a file

```jsonc
{ "command": "grep", "args": ["-n", "TODO", "./output/project/src/main.py"] }
```

### In-place text substitution

```jsonc
{
  "command": "sed",
  "args": ["-i", "s/localhost/0.0.0.0/g", "./output/project/config.json"]
}
```

### Pass an environment variable

```jsonc
{
  "command": "node",
  "args": ["server.js"],
  "env": { "PORT": "8080", "NODE_ENV": "production" },
  "cwd": "./output/project"
}
```

### Provide stdin input

```jsonc
{
  "command": "python",
  "args": ["./scripts/process.py"],
  "input": "line1\nline2\n"
}
```

---

## Filesystem Boundaries

`cwd` is validated against two anchors:

- `path.resolve(".")` — the project root
- `path.resolve("./output")` — the designated output directory

Any resolved path that starts outside these two roots is rejected before the process is spawned. Do not attempt to `cd` into `/tmp`, `/home`, or absolute paths outside the project.

---

## Allowlist Mode

If the environment variable `EXEC_ALLOWED_COMMANDS` is set (comma-separated list of binary names), only those commands are permitted. Attempts to run anything else produce an error before the dangerous-pattern check runs. In allowlist mode, verify that your intended binary (e.g. `npx`, `python3`) is explicitly listed.

---

## Error Reference

| `error` value                              | Meaning                                     | Resolution                                              |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------- |
| `Command "X" is not in the allowed list`   | Allowlist mode active; binary not permitted | Use an allowed binary or update `EXEC_ALLOWED_COMMANDS` |
| `Command blocked by security policy`       | Matched a blocked pattern                   | Reformulate the command to avoid the pattern            |
| `cwd "…" is outside the project directory` | `cwd` resolves outside project/output roots | Use a relative path inside the project                  |
| `Output exceeded max buffer`               | stdout or stderr exceeded `maxBuffer`       | Reduce output verbosity or write results to a file      |
| `Process spawn failed: …`                  | Binary not found or permission denied       | Verify the binary is installed and on `PATH`            |

---

## Agent Decision Checklist

Before calling `executeCommand`:

1. **Is `command` a bare binary name?** Arguments belong in `args`, not appended to the command string.
2. **Does the script use relative paths?** Set `cwd` explicitly.
3. **Will the run take more than 30 s?** Pass a higher `timeout` (milliseconds).
4. **Does the command produce large output?** Redirect to a file; do not rely on stdout capture.
5. **Does the command need secrets?** Pass via `env`; never embed in `args` or `command`.
6. **After receiving a result:** inspect both `success` and `diagnostics`; do not assume exit 0 means clean execution.
