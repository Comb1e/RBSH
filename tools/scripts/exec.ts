import type { ToolDefinition } from "@/types/index.js";
import { CommandOptions, CommandOptionsSchema } from "@/schemas/index.js";
import { exec, spawn, ExecException } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Command execution result structure
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  killed: boolean;
  timedOut: boolean;
  command: string;
  duration: number; // execution time in ms
}

// Sanitize output to prevent leaking sensitive information
const sanitizeOutput = (output: string): string => {
  return output
    .replace(/password[=:]\s*\S+/gi, "password=***REDACTED***")
    .replace(/token[=:]\s*\S+/gi, "token=***REDACTED***")
    .replace(/secret[=:]\s*\S+/gi, "secret=***REDACTED***")
    .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=***REDACTED***")
    .slice(0, 50000); // limit output length to prevent log flooding
};

// Check command safety to avoid dangerous operations
const isCommandSafe = (command: string): boolean => {
  const dangerousPatterns = [
    /rm\s+(-rf?|--recursive)\s+\//i,
    /rm\s+-rf?\s+\.\//i,
    /dd\s+if=/i,
    /mkfs/i,
    /chmod\s+777\s+\//i,
    />\s*\/dev\/sd/i,
    /:\s*\(\)\s*{\s*:;\s*}\)\s*;/i, // fork bomb
    /sudo\s+/i,
    /su\s+-/i,
  ];
  return !dangerousPatterns.some((pattern) => pattern.test(command));
};

/**
 * Execute a shell command with robust error handling
 * @param options Command execution options
 * @returns Command execution result
 */
const executeCommand = async (
  options: CommandOptions
): Promise<CommandResult> => {
  const startTime = Date.now();
  let timedOut = false;
  let killed = false;
  let exitCode: number | null = null;

  if (!isCommandSafe(options.command)) {
    throw new Error(
      "Command contains dangerous operations and was blocked by security policy"
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(options.command, {
      cwd: options.cwd,
      shell: options.shell,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > options.maxBuffer) {
        child.kill("SIGTERM");
        reject(
          new Error(
            `Output exceeded max buffer limit (${options.maxBuffer} bytes)`
          )
        );
      }
      stdout += chunk;
    });

    child.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > options.maxBuffer) {
        child.kill("SIGTERM");
        reject(
          new Error(
            `Error output exceeded max buffer limit (${options.maxBuffer} bytes)`
          )
        );
      }
      stderr += chunk;
    });

    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Give process time to handle SIGTERM, then force kill
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 5000);
    }, options.timeout);

    child.on("close", (code, signal) => {
      clearTimeout(timeoutId);
      exitCode = code;
      killed = signal !== null;
      const duration = Date.now() - startTime;
      resolve({
        stdout: sanitizeOutput(stdout),
        stderr: sanitizeOutput(stderr),
        exitCode,
        killed,
        timedOut,
        command: options.command,
        duration,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Process spawn failed: ${error.message}`));
    });
  });
};

// Tool definition for agent consumption
export const executeCommandTool = {
  name: "execute_command",
  description: `Execute a command in the system shell.

Use cases:
- Run system commands or scripts
- File operations (create, read, modify)
- Process management
- Network requests (curl, wget, etc.)

Security restrictions:
- Dangerous commands (rm -rf /, dd, mkfs, etc.) are blocked
- Default timeout: 30 seconds
- Max output buffer: 10MB
- Sensitive info (password, token, etc.) auto-redacted

Recommendations:
- Avoid commands requiring sudo
- Set a reasonable timeout for long-running commands
- Be mindful of output size to avoid memory overflow`,

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
        const errorMsg = result.timedOut
          ? `Command timed out after ${args.timeout}ms`
          : result.exitCode !== 0
          ? `Command failed with exit code ${result.exitCode}`
          : "Command execution failed";

        return {
          success: false,
          error: errorMsg,
          data: result,
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("exceeded max buffer limit")) {
        return {
          success: false,
          error: `Output too large. Try: 1) Redirect output to a file 2) Reduce data volume 3) Increase maxBuffer`,
        };
      }

      if (errorMessage.includes("Process spawn failed")) {
        return {
          success: false,
          error: `Command execution failed: ${errorMessage}. Check: 1) Command exists 2) Execute permissions 3) Correct path`,
        };
      }

      if (errorMessage.includes("dangerous operations")) {
        return {
          success: false,
          error: `Security policy blocked: ${errorMessage}`,
        };
      }

      return {
        success: false,
        error: `Command execution error: ${errorMessage}`,
      };
    }
  },
};

export const commandToolDefinition: ToolDefinition<
  typeof CommandOptionsSchema
> = executeCommandTool;
