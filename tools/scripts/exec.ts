import * as path from "path";
import { fileURLToPath } from "node:url";
import type { ToolDefinition } from "@/types/index.js";
import {
  CommandOptions,
  CommandOptionsSchema,
  ExecuteCommandOptions,
} from "@/schemas/index.js";
import { spawn, ChildProcess } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** Set by the harness to the project output directory. Used as default cwd. */
let projectOutputDir: string | undefined;

export function setExecuteDefaultCwd(dir: string) {
  projectOutputDir = path.resolve(dir);
}

export function getExecuteDefaultCwd(): string | undefined {
  return projectOutputDir;
}

// ── Command safety ───────────────────────────────────────────────────────────

/** Allow-listed commands (checked first if env EXEC_ALLOWED_COMMANDS is set). */
function getAllowedCommands(): Set<string> | null {
  const raw = process.env.EXEC_ALLOWED_COMMANDS;
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Patterns that are unconditionally blocked even outside allowlist mode. */
const BLOCKED_PATTERNS = [
  /rm\s+(-[rRf]+\s+)+\//, // rm -rf /
  /rm\s+-[rRf]+\s+\$/, // rm -rf $VAR (environment destruction)
  /rm\s+-[rRf]+\s+~/, // rm -rf ~ (home directory)
  /dd\s+if=/i, // raw disk operations
  /mkfs/i, // filesystem creation
  /chmod\s+777\s+\//i, // world-writable root
  />\s*\/dev\/sd/i, // overwriting block devices
  /:\s*\(\)\s*{\s*:;\s*}\)\s*;/i, // fork bomb
  /sudo\s+rm/i, // sudo rm
  />\s*\/etc\//i, // overwriting /etc
  /curl.*\|\s*(ba)?sh/i, // curl pipe shell
  /wget.*-O\s*-\s*\|/i, // wget pipe
];

function extractBaseCommand(command: string): string {
  return command.trim().split(/\s+/)[0];
}

function isCommandSafe(command: string, args: string[]): boolean {
  // Allowlist mode: only allow explicitly listed commands
  const allowed = getAllowedCommands();
  if (allowed) {
    const base = extractBaseCommand(command);
    if (!allowed.has(base)) {
      throw new Error(
        `Command "${base}" is not in the allowed list. Allowed: ${[
          ...allowed,
        ].join(", ")}`
      );
    }
  }

  // Build full command string for pattern matching
  const fullCommand =
    args.length > 0 ? `${command} ${args.join(" ")}` : command;

  // Always block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(fullCommand)) {
      throw new Error(
        `Command blocked by security policy (matched: ${pattern.source})`
      );
    }
  }

  return true;
}

// ── Output sanitization ──────────────────────────────────────────────────────

function sanitizeOutput(output: string): string {
  return output
    .replace(/password[=:]\s*\S+/gi, "password=***REDACTED***")
    .replace(/token[=:]\s*\S+/gi, "token=***REDACTED***")
    .replace(/secret[=:]\s*\S+/gi, "secret=***REDACTED***")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=***REDACTED***")
    .slice(0, 50000);
}

// ── Command execution ────────────────────────────────────────────────────────

interface CommandDiagnostics {
  errors: string[];
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed: boolean;
  timedOut: boolean;
  command: string;
  duration: number;
  diagnostics?: CommandDiagnostics;
}

// ── Error pattern scanning ─────────────────────────────────────────────────────

/** Patterns that indicate code printed errors even if exitCode was 0. */
const ERROR_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Python
  {
    pattern: /Traceback\s*\(most recent call last\)/i,
    label: "Python traceback",
  },
  {
    pattern:
      /\b(ModuleNotFoundError|ImportError|SyntaxError|IndentationError)\b/,
    label: "Python import/syntax error",
  },
  {
    pattern: /\b(ValueError|TypeError|KeyError|IndexError|AttributeError)\b/,
    label: "Python runtime error",
  },
  {
    pattern: /\b(FileNotFoundError|PermissionError|OSError|IOError)\b/,
    label: "Python file/OS error",
  },
  {
    pattern: /\b(NameError|UnboundLocalError|RecursionError|AssertionError)\b/,
    label: "Python logic error",
  },
  { pattern: /\bZeroDivisionError\b/, label: "Python division by zero" },
  // JS / Node
  {
    pattern: /\b(ReferenceError|TypeError|SyntaxError|RangeError|URIError)\b/,
    label: "JavaScript error",
  },
  {
    pattern: /UnhandledPromiseRejection/i,
    label: "Unhandled promise rejection",
  },
  { pattern: /Cannot find module\b/i, label: "Node missing module" },
  // Generic / shell
  { pattern: /\bpanic\b/i, label: "panic" },
  { pattern: /\bfatal\s*:/i, label: "fatal error" },
  { pattern: /\bSIGSEGV\b/i, label: "segmentation fault" },
  { pattern: /\bcommand not found\b/i, label: "command not found" },
  { pattern: /\bNo such file or directory\b/i, label: "file not found" },
  { pattern: /\bPermission denied\b/i, label: "permission denied" },
  { pattern: /\bcannot access\b/i, label: "cannot access" },
  // R
  { pattern: /\bError in\b/, label: "R error" },
];

function scanForErrors(
  stdout: string,
  stderr: string
): CommandDiagnostics | undefined {
  const errors: string[] = [];
  const seen = new Set<string>();

  const lines = [...stdout.split("\n"), ...stderr.split("\n")];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    for (const { pattern, label } of ERROR_PATTERNS) {
      if (pattern.test(trimmed)) {
        const entry = `[${label}] ${trimmed.slice(0, 200)}`;
        if (!seen.has(entry)) {
          seen.add(entry);
          errors.push(entry);
        }
      }
    }
  }

  return errors.length > 0 ? { errors } : undefined;
}

function isCwdSafe(cwd: string): boolean {
  const resolved = path.resolve(cwd);
  return resolved.startsWith(PROJECT_ROOT + path.sep) || resolved === PROJECT_ROOT;
}

export function executeCommand(
  options: ExecuteCommandOptions
): Promise<CommandResult> {
  const startTime = Date.now();
  let timedOut = false;
  let killed = false;
  let exitCode: number | null = null;

  const cwd = path.resolve(options.cwd ?? projectOutputDir ?? process.cwd());
  if (!isCwdSafe(cwd)) {
    return Promise.reject(
      new Error(
        `cwd "${cwd}" is outside the project directory. Operations must stay within the project.`
      )
    );
  } else {
    console.log("[executeCommand] Using cwd:", cwd);
  }

  isCommandSafe(options.command, options.args ?? []);

  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(options.command, options.args ?? [], {
      cwd: cwd,
      shell: options.shell ?? false,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdin?.setDefaultEncoding("utf8");

    let stdout = "";
    let stderr = "";

    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    child.stdout?.on("data", (data: string) => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(data) > options.maxBuffer) {
        child.kill("SIGTERM");
        settle(() =>
          reject(
            new Error(`Output exceeded max buffer (${options.maxBuffer} bytes)`)
          )
        );
      }
      stdout += data;
    });

    child.stderr?.on("data", (data: string) => {
      if (Buffer.byteLength(stderr) + Buffer.byteLength(data) > options.maxBuffer) {
        child.kill("SIGTERM");
        settle(() =>
          reject(
            new Error(
              `Error output exceeded max buffer (${options.maxBuffer} bytes)`
            )
          )
        );
      }
      stderr += data;
    });

    if (options.input) {
      child.stdin?.write(options.input);
      child.stdin?.end();
    }

    // Hard timeout — force-kill after timeout + grace period
    const hardTimeoutMs = options.timeout + 10000;
    const hardTimeout = setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      timedOut = true;
      settle(() => {
        const out = sanitizeOutput(stdout);
        const err = sanitizeOutput(stderr);
        resolve({
          stdout: out,
          stderr: err,
          exitCode: null,
          killed: true,
          timedOut: true,
          command: options.command,
          duration: Date.now() - startTime,
          diagnostics: scanForErrors(out, err),
        });
      });
    }, hardTimeoutMs);

    const softTimeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeout);

    child.on("close", (code, signal) => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      exitCode = code;
      killed = signal !== null;
      settle(() => {
        const out = sanitizeOutput(stdout);
        const err = sanitizeOutput(stderr);
        resolve({
          stdout: out,
          stderr: err,
          exitCode,
          killed,
          timedOut,
          command: options.command,
          duration: Date.now() - startTime,
          diagnostics: scanForErrors(out, err),
        });
      });
    });

    child.on("error", (error) => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      settle(() => reject(new Error(`Process spawn failed: ${error.message}`)));
    });
  });
}

// ── Tool definition ──────────────────────────────────────────────────────────

export const commandToolDefinition: ToolDefinition<
  typeof CommandOptionsSchema
> = {
  name: "executeCommand",
  description: `Execute any safe command. Use this for running code, testing, installing dependencies, and modifying files.

For example:
- Run code or scripts: { command: "python", args: ["-m", "src.main"] }
- Run tests or type-check: { command: "npx", args: ["tsc", "--noEmit"] }
- Install dependencies: { command: "npm", args: ["install"] }
- Read a file: { command: "cat", args: ["./README.md"] }
- Create a file: { command: "tee", args: ["./newfile.py"], input: "print('hello')" }
- Append to a file: { command: "tee", args: ["-a", "./data.csv"], input: "new,row,data" }
- Replace text in a file: { command: "sed", args: ["-i", "s/old/new/g", "./src/main.py"] }
- Find text in a file: { command: "grep", args: ["-n", "TODO", "./src/main.py"] }

Always pass arguments via the 'args' array — never embed them in the command string.

For shell redirects (>, >>) and pipes (|), set "shell": true:
{ command: "echo", args: ["new line", ">>", "./log.txt"], shell: true }
When shell:true, redirect operators in args are interpreted by the shell.
When shell:false (default), use "tee" for file writes and "tee -a" for appends.

Security:
- Any command is allowed unless restricted by EXEC_ALLOWED_COMMANDS env var
- Dangerous patterns (rm -rf /, dd, mkfs, curl|sh, etc.) are always blocked
- Default timeout: 30s. Hard kill at timeout + 10s.
- Max output buffer: 10MB
- Sensitive info (password, token) auto-redacted
- shell defaults to false for safe argument handling`,

  schema: CommandOptionsSchema,

  execute: async (
    args: CommandOptions
  ): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    duration?: number;
    diagnostics?: string[];
    timedOut?: boolean;
    error?: string;
  }> => {
    const cmdStr = args.args?.length
      ? `${args.command} ${args.args.join(" ")}`
      : args.command;
    console.log(`[executeCommand] ${cmdStr}`);

    try {
      const result = await executeCommand({
        ...args,
        cwd: projectOutputDir,
      });
      const isSuccess = result.exitCode === 0 && !result.timedOut;

      if (!isSuccess) {
        const stderrPreview = result.stderr ? result.stderr.slice(0, 500) : "";
        const diagErrors = result.diagnostics?.errors;
        console.log(
          `[executeCommand] FAILED (exit ${result.exitCode ?? "timeout"})`
        );
        if (stderrPreview) {
          console.log(`[executeCommand] stderr: ${stderrPreview}`);
        }
        if (diagErrors?.length) {
          console.log(
            `[executeCommand] diagnostics: ${diagErrors
              .join("; ")
              .slice(0, 500)}`
          );
        }
        return {
          success: false,
          error: result.timedOut
            ? `Command timed out after ${args.timeout}ms`
            : `Command exited with code ${result.exitCode}`,
          exitCode: result.exitCode,
          stdout: result.stdout.slice(0, 3000),
          stderr: result.stderr.slice(0, 3000),
          diagnostics: diagErrors,
          timedOut: result.timedOut,
          duration: result.duration,
        };
      }

      console.log(`[executeCommand] Exit 0 (${result.duration}ms)`);
      return {
        success: true,
        stdout: result.stdout.slice(0, 1000),
        stderr: result.stderr.slice(0, 500),
        duration: result.duration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[executeCommand] FAILED: ${message}`);
      return { success: false, error: message };
    }
  },
};
