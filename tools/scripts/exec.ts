import * as path from "path";
import type { ToolDefinition } from "@/types/index.js";
import { CommandOptions, CommandOptionsSchema } from "@/schemas/index.js";
import { spawn, ChildProcess } from "child_process";

// ── Command safety ───────────────────────────────────────────────────────────

/** Allow-listed commands (checked first if env EXEC_ALLOWED_COMMANDS is set). */
function getAllowedCommands(): Set<string> | null {
  const raw = process.env.EXEC_ALLOWED_COMMANDS;
  if (!raw) return null;
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

/** Patterns that are unconditionally blocked even outside allowlist mode. */
const BLOCKED_PATTERNS = [
  /rm\s+(-[rRf]+\s+)+\//,          // rm -rf /
  /rm\s+-[rRf]+\s+\$/,             // rm -rf $VAR (environment destruction)
  /rm\s+-[rRf]+\s+~/,              // rm -rf ~ (home directory)
  /dd\s+if=/i,                     // raw disk operations
  /mkfs/i,                         // filesystem creation
  /chmod\s+777\s+\//i,            // world-writable root
  />\s*\/dev\/sd/i,                // overwriting block devices
  /:\s*\(\)\s*{\s*:;\s*}\)\s*;/i,  // fork bomb
  /sudo\s+rm/i,                    // sudo rm
  />\s*\/etc\//i,                  // overwriting /etc
  /curl.*\|\s*(ba)?sh/i,           // curl pipe shell
  /wget.*-O\s*-\s*\|/i,            // wget pipe
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
        `Command "${base}" is not in the allowed list. Allowed: ${[...allowed].join(", ")}`
      );
    }
  }

  // Build full command string for pattern matching
  const fullCommand = args.length > 0
    ? `${command} ${args.join(" ")}`
    : command;

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

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed: boolean;
  timedOut: boolean;
  command: string;
  duration: number;
}

function isCwdSafe(cwd: string): boolean {
  const resolved = path.resolve(cwd);
  const projectRoot = path.resolve(".");
  const outputDir = path.resolve("./output");
  return resolved.startsWith(projectRoot) || resolved.startsWith(outputDir);
}

function executeCommand(options: CommandOptions): Promise<CommandResult> {
  const startTime = Date.now();
  let timedOut = false;
  let killed = false;
  let exitCode: number | null = null;

  const cwd = options.cwd ?? process.cwd();
  if (!isCwdSafe(cwd)) {
    return Promise.reject(
      new Error(`cwd "${cwd}" is outside the project directory. Operations must stay within the project.`)
    );
  }

  isCommandSafe(options.command, options.args ?? []);

  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(options.command, options.args ?? [], {
      cwd: options.cwd ?? process.cwd(),
      shell: options.shell ?? false,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > options.maxBuffer) {
        child.kill("SIGTERM");
        settle(() =>
          reject(new Error(`Output exceeded max buffer (${options.maxBuffer} bytes)`))
        );
      }
      stdout += chunk;
    });

    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > options.maxBuffer) {
        child.kill("SIGTERM");
        settle(() =>
          reject(new Error(`Error output exceeded max buffer (${options.maxBuffer} bytes)`))
        );
      }
      stderr += chunk;
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
      settle(() =>
        resolve({
          stdout: sanitizeOutput(stdout),
          stderr: sanitizeOutput(stderr),
          exitCode: null,
          killed: true,
          timedOut: true,
          command: options.command,
          duration: Date.now() - startTime,
        })
      );
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
      settle(() =>
        resolve({
          stdout: sanitizeOutput(stdout),
          stderr: sanitizeOutput(stderr),
          exitCode,
          killed,
          timedOut,
          command: options.command,
          duration: Date.now() - startTime,
        })
      );
    });

    child.on("error", (error) => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      settle(() => reject(new Error(`Process spawn failed: ${error.message}`)));
    });
  });
}

// ── Tool definition ──────────────────────────────────────────────────────────

export const executeCommandTool = {
  name: "execute_command",
  description: `Execute a command safely without a shell.

Use cases:
- Run generated code: { command: "python", args: ["src/main.py"] }
- Run tests: { command: "npm", args: ["test"], cwd: "./output/project" }
- Type-check: { command: "npx", args: ["tsc", "--noEmit"] }
- Install deps: { command: "pip", args: ["install", "-r", "requirements.txt"] }

Always pass arguments via the 'args' array — never embed them in the command string.
Set 'cwd' to the output directory when running scripts that use relative paths.

Security:
- Allowlist mode when EXEC_ALLOWED_COMMANDS env is set (e.g. "python,node,npm")
- Dangerous patterns (rm -rf /, dd, mkfs, curl|sh, etc.) are always blocked
- cwd is restricted to the project directory and ./output
- Default timeout: 30s. Hard kill at timeout + 10s.
- Max output buffer: 10MB
- Sensitive info (password, token) auto-redacted
- shell defaults to false for safe argument handling`,

  schema: CommandOptionsSchema,

  execute: async (
    args: CommandOptions
  ): Promise<{
    success: boolean;
    data?: CommandResult;
    error?: string;
  }> => {
    try {
      const result = await executeCommand(args);
      const isSuccess = result.exitCode === 0 && !result.timedOut;

      if (!isSuccess) {
        return {
          success: false,
          error: result.timedOut
            ? `Command timed out after ${args.timeout}ms`
            : `Command failed with exit code ${result.exitCode}`,
          data: result,
        };
      }

      return { success: true, data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  },
};

export const commandToolDefinition: ToolDefinition<
  typeof CommandOptionsSchema
> = executeCommandTool;
